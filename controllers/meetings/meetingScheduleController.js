/**
 * controllers/meetingScheduleController.js
 * Aggregates meetings across all connected instructors.
 * Logic only — all DB queries are in MeetingModel and CalendarUsersModel.
 */
const MeetingModel = require('../../models/meetings/MeetingModel');
const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
const CalendarEventController = require('../calendar/CalendarEventController');
const CalendarHelper = require('../../utils/calendarHelper');
const { logger } = require('../../utils/logger');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

function groupByAccount(rows) {
  const groups = {};
  rows.forEach(r => {
    const email = (r.calendar_account || '').toLowerCase();
    if (!groups[email]) groups[email] = { email, events: [], role_name: r.role_name || 'instructor' };
    groups[email].events.push({
      title: r.title || 'Untitled',
      start_time: r.start_time,
      end_time: r.end_time,
      platform: r.platform || null
    });
  });
  return Object.values(groups).map(g => ({ email: g.email, role_name: g.role_name, total: g.events.length, events: g.events }));
}

async function getActiveEmails() {
  const connections = await CalendarUsersModel.getAllUsers();
  return (connections || []).filter(c => c.status === 'active' && c.email && (c.access_token || c.token_expiry)).map(c => c.email.toLowerCase());
}

const controller = {
  /** POST /api/meeting-schedule/sync */
  async syncMeetings(req) {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const adminId = req.user ? req.user.id : null;
      const connections = await CalendarUsersModel.getAllUsers();
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
      
      // Get ALL connected users (not just those with meetings)
      const connections = await CalendarUsersModel.getAllUsers();
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
      const activeEmails = await getActiveEmails();
      if (!activeEmails.length) return ok({ users: [], totalUsers: 0, totalEvents: 0 });
      const rows = await MeetingModel.getLiveMeetingsByAccounts(activeEmails);
      const users = groupByAccount(rows);
      return ok({ users, totalUsers: users.length, totalEvents: rows.length });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/meeting-schedule/completed?hours=24 */
  async getCompletedMeetings(req) {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const adminId = req.user ? req.user.id : null;
      // Get ALL completed meetings (not filtered by calendar connections — show all data)
      const rows = await MeetingModel.getCompletedMeetingsByAccounts([], hours);
      const users = groupByAccount(rows);
      
      // Connected calendars count from calendar_integrations, users, roles, calendar_verifications & created_by admin
      const connectedCount = await CalendarUsersModel.getConnectedCalendarCount(adminId);
      
      return ok({ hours, users, totalUsers: users.length, totalEvents: users.reduce((s,u)=>s+u.total,0), connectedUsers: connectedCount });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;