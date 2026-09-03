/**
 * controllers/meetingScheduleController.js
 * Aggregates meetings across all connected instructors.
 * Logic only — all DB queries are in MeetingModel and CalendarUsersModel.
 */
const MeetingModel = require('../../models/meetings/MeetingModel');
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
const UsersModel = require('../../models/users/UsersModel');
const CalendarEventController = require('../calendar/CalendarEventController');
const CalendarHelper = require('../../utils/calendarHelper');
const TranscriptModel = require('../../models/transcripts/transcriptModel');
const { logger } = require('../../utils/logger');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

function groupByAccount(rows) {
  const groups = {};
  rows.forEach(r => {
    const email = (r.calendar_account || '').toLowerCase();
    if (!groups[email]) groups[email] = { email, events: [], role_name: r.role_name || 'instructor' };
    
    // Calculate duration in minutes
    let duration = null;
    if (r.scheduled_start_time && r.scheduled_end_time) {
      const start = new Date(r.scheduled_start_time);
      const end = new Date(r.scheduled_end_time);
      duration = Math.round((end - start) / 60000); // Convert ms to minutes
    }
    
    groups[email].events.push({
      title: r.title || 'Untitled',
      scheduled_start_time: r.scheduled_start_time,
      scheduled_end_time: r.scheduled_end_time,
      start_time: r.scheduled_start_time,
      end_time: r.scheduled_end_time,
      start: r.scheduled_start_time,
      end: r.scheduled_end_time,
      duration: duration,
      platform: r.platform || null,
      status: r.status || null
    });
  });
  return Object.values(groups).map(g => ({ email: g.email, role_name: g.role_name, total: g.events.length, events: g.events }));
}

async function getActiveEmails(adminId = null, userRole = null) {
  // For admin: only get users they created with instructor/reviewer roles
  const filterOptions = {
    status: 'active',
    email: true
  };
  
  if (userRole === 'admin' && adminId) {
    filterOptions.createdBy = adminId;
    filterOptions.roles = ['instructor', 'solo_instructor', 'reviewer'];
    filterOptions.excludeSelf = true;
    filterOptions.adminId = adminId;
  }
  
  const connections = await CalendarUsersModel.getAllUsers(filterOptions);
  // Filter out users with invalid token status
  const validConnections = (connections || []).filter(c => {
    const hasValidStatus = c.connection_status === 'active';
    const hasTokens = c.email && (c.access_token || c.token_expires_at);
    const notInvalid = c.connection_status !== 'invalid';
    return hasValidStatus && hasTokens && notInvalid;
  });
  
  // Log how many were filtered out due to invalid tokens
  const invalidCount = (connections || []).length - validConnections.length;
  if (invalidCount > 0) {
    logger.warn(`[MeetingSchedule] Filtered out ${invalidCount} users with invalid calendar tokens`);
  }
  
  return validConnections.map(c => c.email.toLowerCase());
}

const controller = {
  /** POST /api/meeting-schedule/sync */
  async syncMeetings(req) {
    try {
      // Support both GET (query params) and POST (request body)
      const hours = parseInt(req.body?.hours || req.query.hours) || 24;
      const adminId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.role_name : null;
      
      // For admin: only get users they created with instructor/reviewer roles
      const filterOptions = {};
      if (userRole === 'admin' && adminId) {
        filterOptions.createdBy = adminId;
        filterOptions.roles = ['instructor', 'solo_instructor'];
        filterOptions.excludeSelf = true;
        filterOptions.adminId = adminId;
      }
      
      const connections = await CalendarUsersModel.getAllUsers(filterOptions);
      const activeConnections = (connections || []).filter(c => c.connection_status === 'active' && c.email && (c.access_token || c.token_expires_at));
      if (!activeConnections.length) return ok({ users: [], totalUsers: 0, totalEvents: 0, synced: 0, message: 'No connected accounts' });

      const now = new Date();
      const future = new Date(now.getTime() + hours * 3600000);
      let totalStored = 0;

      await Promise.all(activeConnections.map(async (conn) => {
        try {
          let events = [];
          try {
            events = await CalendarEventController.getEvents(conn.email, {
              timeMin: now.toISOString(),
              timeMax: future.toISOString(),
              maxResults: 2500
            });
          } catch (fe) { 
            // Check if it's an authentication error (401)
            if (fe.message && (fe.message.includes('Invalid Credentials') || fe.message.includes('401') || fe.code === 401)) {
              logger.warn('[MeetingSchedule] Invalid credentials for '+conn.email+' - marking as needs re-authentication');
              // Mark this user's calendar integration as needing re-authentication
              try {
                await CalendarUsersModel.updateTokenStatus(conn.user_id_ref || conn.user_id, 'invalid');
              } catch (updateErr) {
                logger.error('[MeetingSchedule] Failed to update token status:', updateErr.message);
              }
            } else {
              logger.warn('[MeetingSchedule] Fetch failed for '+conn.email+':', fe.message);
            }
            return; 
          }

          for (const e of events) {
            const link = e.hangoutLink || CalendarHelper.extractMeetingLink(e.description, e.location || '');
            const pt = CalendarHelper.detectPlatform(link, e.location);
            if (pt && pt !== 'unknown') {
              const { meetingId, passcode } = CalendarHelper.extractMeetingId(link, pt, e.description || '', e.location || '');
              if (meetingId && meetingId !== 'unknown' && meetingId !== 'null') {
                const result = await MeetingModel.getMeetingByIdOrCreate({ meetingId, platform: pt, eventId: e.id, passcode, account: conn.email, meetingLink: link, scheduled_start_time: e.start.dateTime || e.start.date, scheduled_end_time: e.end.dateTime || e.end.date, timezone: e.start.timezone, title: e.summary || 'Untitled Meeting' });
                if (result.created || result.updated) {
                  totalStored++;
                }
              }
            }
          }
        } catch (e) { logger.warn('[MeetingSchedule] Error processing '+conn.email+':', e.message); }
      }));
      const activeEmails = activeConnections.map(c => c.email.toLowerCase());
      const rows = await MeetingModel.getMeetingsByAccounts(activeEmails, hours);

      // Include ALL active connections as users (even those with 0 meetings)
      const usersFromMeetings = groupByAccount(rows);
      const eventsByEmail = {};
      usersFromMeetings.forEach(u => {
        eventsByEmail[u.email] = (u.events || []).map(e => ({
          title: e.title,
          start_time: e.scheduled_start_time,
          end_time: e.scheduled_end_time,
          platform: e.platform,
          duration: e.duration
        }));
      });

      const normalizedUsers = activeConnections.map(c => {
        const email = c.email.toLowerCase();
        const events = eventsByEmail[email] || [];
        return {
          email: c.email,
          role_name: c.role_name || 'instructor',
          total: events.length,
          events
        };
      });

      const connectedCount = await CalendarUsersModel.getConnectedCalendarCount(adminId);

      return ok({
        hours,
        users: normalizedUsers,
        totalUsers: normalizedUsers.length,
        totalEvents: normalizedUsers.reduce((s,u)=>s+u.total,0),
        synced: totalStored,
        connectedUsers: connectedCount
      });
    } catch (e) { return err(e.message); }
  },

  /** GET/POST /api/meeting-schedule/all */
  async getAllMeetings(req) {
    try {
      // Support both GET (query params) and POST (request body)
      const hours = parseInt(req.body?.hours || req.query.hours) || 24;
      const fromDate = req.body?.from_date || req.query.from_date || null;
      const toDate = req.body?.to_date || req.query.to_date || null;
      const instructorId = req.body?.instructor_id || req.query.instructor_id || null;
      const adminId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.role_name : null;
      
      // Determine which emails to fetch
      let targetEmails = [];
      
      if (instructorId) {
        // If specific instructor selected, get only that instructor's email
        const instructor = await CalendarUsersModel.getUserById(instructorId);
        if (instructor && instructor.email) {
          targetEmails = [instructor.email.toLowerCase()];
        }
      } else {
        // For admin: only get users they created with instructor/reviewer roles
        const filterOptions = {};
        if (userRole === 'admin' && adminId) {
          filterOptions.createdBy = adminId;
          filterOptions.roles = ['instructor', 'solo_instructor', 'reviewer'];
          filterOptions.excludeSelf = true;
          filterOptions.adminId = adminId;
        }
        
        // Get ALL connected users (not just those with meetings)
        const connections = await CalendarUsersModel.getAllUsers(filterOptions);
        targetEmails = (connections || []).filter(c => c.connection_status === 'active' && c.email).map(c => c.email.toLowerCase());
      }
      
      // Calculate time range
      let fromTime, toTime;
      if (fromDate && toDate) {
        // Use provided date range
        fromTime = new Date(fromDate + 'T00:00:00');
        toTime = new Date(toDate + 'T23:59:59');
      } else {
        // Fallback to hours-based range
        const now = new Date();
        fromTime = new Date(now.getTime() - hours * 3600000);
        toTime = new Date(now.getTime() + hours * 3600000);
      }
      
      // Get meetings for the target emails within the time range
      const rows = await MeetingModel.getMeetingsByDateRange(targetEmails, fromTime, toTime);

      // Group meetings by account
      const meetingsByAccount = {};
      (rows || []).forEach(r => {
        const email = (r.calendar_account || '').toLowerCase();
        if (!meetingsByAccount[email]) meetingsByAccount[email] = [];
        meetingsByAccount[email].push({
          title: r.title,
          start_time: r.scheduled_start_time,
          end_time: r.scheduled_end_time,
          platform: r.platform,
          // send duration when possible (helps UI)
          duration: r.duration
        });
      });

      
      // Build users array with ALL connected users, even those without meetings
      const users = targetEmails.map(email => {
        const events = meetingsByAccount[email] || [];
        return {
          email: email,
          role_name: 'instructor',
          total: events.length,
          events: events
        };
      });
      
      // If instructor was selected, get their details
      if (instructorId && users.length > 0) {
        const instructor = await CalendarUsersModel.getUserById(instructorId);
        if (instructor) {
          users[0].role_name = instructor.role_name || 'instructor';
          users[0].email = instructor.email;
        }
      }
      
      // Connected calendars count
      const connectedCount = users.length;
      const totalEvents = users.reduce((s,u) => s + u.total, 0);
      
      return ok({ 
        hours, 
        from_date: fromDate,
        to_date: toDate,
        instructor_id: instructorId,
        users, 
        totalUsers: connectedCount, 
        totalEvents, 
        connectedUsers: connectedCount 
      });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/meeting-schedule/live */
  async getLiveMeetings(req) {
    try {
      const adminId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.role_name : null;
      const activeEmails = await getActiveEmails(adminId, userRole);
      if (!activeEmails.length) return ok({ users: [], totalUsers: 0, totalEvents: 0 });
      
      // Get full meeting rows including external_meeting_id, meeting_link, passcode, event_id
      const rows = await MeetingModel.getLiveMeetingsByAccounts(activeEmails);
      
      // Group meetings by account - include ALL fields needed for bot join
      const groups = {};
      rows.forEach(r => {
        const email = (r.calendar_account || '').toLowerCase();
        if (!groups[email]) groups[email] = { email, events: [], role_name: r.role_name || 'instructor' };
        groups[email].events.push({
          id: r.id,
          meeting_id: r.external_meeting_id,
          event_id: r.event_id,
          title: r.title || 'Untitled',
          start: r.scheduled_start_time,
          end: r.scheduled_end_time,
          start_time: r.scheduled_start_time,
          end_time: r.scheduled_end_time,
          platform: r.platform || null,
          meeting_link: r.meeting_link || null,
          passcode: r.passcode || null,
          link: r.meeting_link || null,
          status: r.status || null,
          calendar_account: r.calendar_account || null
        });
      });
      const users = Object.values(groups).map(g => g);
      
      return ok({ users, totalUsers: users.length, totalEvents: rows.length });
    } catch (e) { return err(e.message); }
  },

  /** POST /api/meeting-schedule/completed */
  async getCompletedMeetings(req) {
    try {
      const hours = parseInt(req.body?.hours || req.query.hours) || 24;
      const fromDate = req.body?.from_date || req.query.from_date || null;
      const toDate = req.body?.to_date || req.query.to_date || null;
      const instructorId = req.body?.instructor_id || req.query.instructor_id || null;
      const adminId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.role_name : null;

      // Determine which emails to fetch
      let targetEmails = [];
      if (instructorId) {
        // instructor_id is a users.user_uuid for the admin filter
        let instructor = null;
        try {
          instructor = await UsersModel.getUserByUuid(instructorId);
        } catch (lookupErr) {
          logger.warn('[MeetingSchedule] getUserByUuid failed:', lookupErr.message);
        }
        if (instructor && instructor.email) {
          targetEmails = [instructor.email.toLowerCase()];
        } else {
          logger.warn(`[MeetingSchedule] Instructor not found for uuid: ${instructorId}`);
        }
      } else {
        // For admin: only get users they created with instructor/reviewer roles
        const filterOptions = {};
        if (userRole === 'admin' && adminId) {
          filterOptions.createdBy = adminId;
          filterOptions.roles = ['instructor', 'solo_instructor', 'reviewer'];
          filterOptions.excludeSelf = true;
          filterOptions.adminId = adminId;
        }
        const connections = await CalendarUsersModel.getAllUsers(filterOptions);
        targetEmails = (connections || []).filter(c => c.connection_status === 'active' && c.email).map(c => c.email.toLowerCase());
      }

      // Get completed meetings (filtered by SQL: meeting_assets has data; no status check)
      const rows = await MeetingModel.getCompletedMeetingsByAccounts(targetEmails, hours, { from_date: fromDate, to_date: toDate });
      const users = groupByAccount(rows);

      // Connected calendars count from calendar_connections, users, roles, calendar_connections & created_by admin
      const connectedCount = await CalendarUsersModel.getConnectedCalendarCount(adminId);

      return ok({ hours, from_date: fromDate, to_date: toDate, instructor_id: instructorId, users, totalUsers: users.length, totalEvents: users.reduce((s,u)=>s+u.total,0), connectedUsers: connectedCount });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;