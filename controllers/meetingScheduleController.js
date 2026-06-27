/**
 * controllers/meetingScheduleController.js
 * Aggregates meetings across all connected instructors.
 * Logic only — all DB queries are in MeetingModel and CalendarUsersModel.
 */
const MeetingModel = require('../models/MeetingModel');
const CalendarUsersModel = require('../models/CalendarUsersModel');
const MultiUserCalendarService = require('../services/calendar/MultiUserCalendarService');
const { logger } = require('../utils/logger');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

// ─── Helpers for Google Calendar parsing ──────────────────────────────────

function extractMeetingLink(text = '', location = '') {
  if (!text) return null;
  const matches = text.match(/https?:\/\/[^\s<>\]]+/g);
  if (!matches) return null;
  for (let url of matches) {
    url = url.replace(/[>\])"']+$/, '');
    if (url.includes('zoom.us') || url.includes('teams.microsoft.com') || url.includes('teams.live.com') ||
        url.includes('meet.google.com') || url.includes('webex.com') || url.includes('gotomeeting.com')) {
      return url;
    }
  }
  return null;
}

function detectPlatform(link = '', location = '') {
  if (!link && !location) return 'unknown';
  if (location) {
    const lowerLoc = location.toLowerCase().trim();
    if (lowerLoc === 'zoom' || lowerLoc.includes('zoom.us')) return 'zoom';
    if (lowerLoc.includes('google meet') || lowerLoc.includes('meet.google')) return 'google-meet';
    if (lowerLoc.includes('teams')) return 'teams';
  }
  if (link) {
    const lowerLink = link.toLowerCase();
    if (lowerLink.includes('meet.google.com')) return 'google-meet';
    if (lowerLink.includes('zoom.us')) return 'zoom';
    if (lowerLink.includes('teams.microsoft.com') || lowerLink.includes('teams.live.com')) return 'teams';
  }
  return 'unknown';
}

function extractMeetingId(link, platform, desc = '', loc = '') {
  let meetingId = null;
  let passcode = null;
  if (platform === 'zoom') {
    try { if (link) { const u = new (require('url').URL)(link); const m = u.pathname.match(/\/j\/(\d+)/); if (m) meetingId = m[1]; } } catch {}
    if (desc) {
      const idM = desc.match(/Meeting ID[:\s]*([\d\s]+)/i);
      if (idM) meetingId = idM[1].replace(/\s/g, '');
      const pM = desc.match(/(?:Passcode|Password)[:\s]*([\w]+)/i);
      if (pM) passcode = pM[1];
    }
    return { meetingId, passcode };
  }
  if (platform === 'teams') {
    if (!link) return { meetingId: null, passcode: null };
    let p = null;
    const pM = desc.match(/(?:Passcode|Password)[:\s]*([\w]+)/i) || link.match(/[?&](?:passcode|pwd|p)=([^&]+)/i);
    if (pM) p = pM[1];
    const om = link.match(/meetup-join\/([^/?]+)/);
    if (om) { const d = decodeURIComponent(om[1]); const mm = d.match(/(meeting_[^@]+)/); return { meetingId: mm ? mm[1] : d, passcode: p }; }
    const lm = link.match(/meet\/(\d+)/);
    if (lm) return { meetingId: lm[1], passcode: p };
    return { meetingId: 'teams-' + Date.now(), passcode: p };
  }
  if (platform === 'google-meet') {
    const mu = loc || link;
    if (!mu) return { meetingId: null, passcode: null };
    try { const u = new (require('url').URL)(mu); return { meetingId: u.pathname.replace('/', '') || null, passcode: null }; }
    catch { return { meetingId: null, passcode: null }; }
  }
  return { meetingId: null, passcode: null };
}

function groupByAccount(rows) {
  const groups = {};
  rows.forEach(r => {
    const email = (r.calendar_account || '').toLowerCase();
    if (!groups[email]) groups[email] = { email, events: [], role_name: r.role_name || 'instructor' };
    groups[email].events.push({
      id: r.meeting_id, title: r.title || 'Untitled', start: r.start_time, end: r.end_time,
      link: r.meeting_link || null, platform: r.platform || null, status: r.status || 'scheduled',
      duration: r.duration || null, participants: r.participant_count || 0,
      bot_joined_at: r.bot_joined_at || null, bot_left_at: r.bot_left_at || null
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
      const connections = await CalendarUsersModel.getAllUsers();
      const activeConnections = (connections || []).filter(c => c.status === 'active' && c.email && (c.access_token || c.token_expiry));
      if (!activeConnections.length) return ok({ users: [], totalUsers: 0, totalEvents: 0, synced: 0, message: 'No connected accounts' });

      const now = new Date();
      const future = new Date(now.getTime() + hours * 3600000);
      let totalStored = 0;

      await Promise.all(activeConnections.map(async (conn) => {
        try {
          const service = new MultiUserCalendarService();
          await service.initialize(conn.email);
          await service.ensureValidToken();
          let events = [];
          try { events = await service.getEvents({ timeMin: now.toISOString(), timeMax: future.toISOString(), maxResults: 20 }); }
          catch (fe) { logger.warn('[MeetingSchedule] Fetch failed for '+conn.email+':', fe.message); return; }

          for (const e of events) {
            const link = e.hangoutLink || extractMeetingLink(e.description, e.location || '');
            const pt = detectPlatform(link, e.location);
            if (pt && pt !== 'unknown') {
              const { meetingId, passcode } = extractMeetingId(link, pt, e.description || '', e.location || '');
              if (meetingId && meetingId !== 'unknown' && meetingId !== 'null') {
                await MeetingModel.getMeetingByIdOrCreate({ meetingId, platform: pt, eventId: e.id, passcode, account: conn.email, meetingLink: link, startTime: e.start.dateTime || e.start.date, endTime: e.end.dateTime || e.end.date, timezone: e.start.timezone, title: e.summary || 'Untitled Meeting' });
                totalStored++;
              }
            }
          }
        } catch (e) { logger.warn('[MeetingSchedule] Error processing '+conn.email+':', e.message); }
      }));

      const activeEmails = activeConnections.map(c => c.email.toLowerCase());
      const rows = await MeetingModel.getMeetingsByAccounts(activeEmails, hours);
      const users = groupByAccount(rows);
      return ok({ hours, users, totalUsers: users.length, totalEvents: users.reduce((s,u)=>s+u.total,0), synced: totalStored });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/meeting-schedule/all?hours=24 */
  async getAllMeetings(req) {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const activeEmails = await getActiveEmails();
      const rows = await MeetingModel.getMeetingsByAccounts(activeEmails, hours);
      const users = groupByAccount(rows);
      
      // Connected users count is always from calendar_integrations, not dependent on meetings
      const connections = await CalendarUsersModel.getAllUsers();
      const connectedCount = (connections || []).filter(c => c.status === 'active' && c.email).length;
      
      return ok({ hours, users, totalUsers: users.length, totalEvents: users.reduce((s,u)=>s+u.total,0), connectedUsers: connectedCount });
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
      // Get ALL completed meetings (not filtered by calendar connections — show all data)
      const rows = await MeetingModel.getCompletedMeetingsByAccounts([], hours);
      const users = groupByAccount(rows);
      
      // Also get total connected users count
      const connections = await CalendarUsersModel.getAllUsers();
      const connectedCount = (connections || []).filter(c => c.status === 'active' && c.email).length;
      
      return ok({ hours, users, totalUsers: users.length, totalEvents: users.reduce((s,u)=>s+u.total,0), connectedUsers: connectedCount });
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;