/**
 * controllers/meetingScheduleController.js
 * Aggregates meetings across all connected instructors.
 * Logic only — all DB queries are in MeetingModel and CalendarUsersModel.
 */
const MeetingModel = require('../../models/meetings/MeetingModel');
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
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
      start_time: r.scheduled_start_time,
      end_time: r.scheduled_end_time,
      duration: duration,
      platform: r.platform || null
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
  return (connections || []).filter(c => c.status === 'active' && c.email && (c.access_token || c.token_expiry)).map(c => c.email.toLowerCase());
}

const controller = {
  /** POST /api/meeting-schedule/sync */
  async syncMeetings(req) {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const adminId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.role_name : null;
      
      // For admin: only get users they created with instructor/reviewer roles
      const filterOptions = {};
      if (userRole === 'admin' && adminId) {
        filterOptions.createdBy = adminId;
        filterOptions.roles = ['instructor', 'solo_instructor', 'reviewer'];
        filterOptions.excludeSelf = true;
        filterOptions.adminId = adminId;
      }
      
      const connections = await CalendarUsersModel.getAllUsers(filterOptions);
      const activeConnections = (connections || []).filter(c => c.status === 'active' && c.email && (c.access_token || c.token_expiry));
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
          } catch (fe) { logger.warn('[MeetingSchedule] Fetch failed for '+conn.email+':', fe.message); return; }

          for (const e of events) {
            const link = e.hangoutLink || CalendarHelper.extractMeetingLink(e.description, e.location || '');
            const pt = CalendarHelper.detectPlatform(link, e.location);
            if (pt && pt !== 'unknown') {
              const { meetingId, passcode } = CalendarHelper.extractMeetingId(link, pt, e.description || '', e.location || '');
              if (meetingId && meetingId !== 'unknown' && meetingId !== 'null') {
                const result = await MeetingModel.getMeetingByIdOrCreate({ meetingId, platform: pt, eventId: e.id, passcode, account: conn.email, meetingLink: link, startTime: e.start.dateTime || e.start.date, endTime: e.end.dateTime || e.end.date, timezone: e.start.timezone, title: e.summary || 'Untitled Meeting' });
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
          start_time: e.start_time,
          end_time: e.end_time,
          platform: e.platform
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

  /** GET /api/meeting-schedule/all?hours=24 */
  async getAllMeetings(req) {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const adminId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.role_name : null;
      
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
      const activeConnections = (connections || []).filter(c => c.status === 'active' && c.email);
      
      // Get meetings for all active emails
      const activeEmails = activeConnections.map(c => c.email.toLowerCase());
      const rows = await MeetingModel.getMeetingsByAccounts(activeEmails, hours);

      // Group meetings by account
      const meetingsByAccount = {};
      (rows || []).forEach(r => {
        const email = (r.calendar_account || '').toLowerCase();
        if (!meetingsByAccount[email]) meetingsByAccount[email] = [];
        meetingsByAccount[email].push({
          title: r.title,
          start_time: r.start_time,
          end_time: r.end_time,
          platform: r.platform,
          // send duration when possible (helps UI)
          duration: r.duration
        });
      });

      
      // Build users array with ALL connected users, even those without meetings
      const users = activeConnections.map(c => {
        const email = c.email.toLowerCase();
        const events = meetingsByAccount[email] || [];
        return {
          email: c.email,
          role_name: c.role_name || 'instructor',
          total: events.length,
          events: events
        };
      });
      
      // Connected calendars count
      const connectedCount = users.length;
      const totalEvents = users.reduce((s,u) => s + u.total, 0);
      
      return ok({ hours, users, totalUsers: connectedCount, totalEvents, connectedUsers: connectedCount });
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
      const hours = parseInt(req.body.hours) || 24;
      const adminId = req.user ? req.user.id : null;
      // Get completed meetings (filtered by SQL: status='completed' OR has transcript+audio)
      const rows = await MeetingModel.getCompletedMeetingsByAccounts([], hours);
      const users = groupByAccount(rows);
      
      // Connected calendars count from calendar_integrations, users, roles, calendar_verifications & created_by admin
      const connectedCount = await CalendarUsersModel.getConnectedCalendarCount(adminId);
      
      return ok({ hours, users, totalUsers: users.length, totalEvents: users.reduce((s,u)=>s+u.total,0), connectedUsers: connectedCount });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;