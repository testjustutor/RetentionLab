/**
 * models/settings/MeetingSettingsModel.js
 * Data access for meeting settings + meeting stats.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');
const SystemSettingsModel = require('./SystemSettingsModel');

const FIELDS = [
  { key: 'auto_record', type: 'bool', def: true },
  { key: 'retention_days', type: 'int', def: 180 },
  { key: 'default_duration', type: 'int', def: 60 },
  { key: 'default_platform', type: 'string', def: 'zoom' },
  { key: 'auto_transcript', type: 'bool', def: true },
  { key: 'notify_instructor', type: 'bool', def: true },
  { key: 'auto_assign_reviewer', type: 'bool', def: false },
  { key: 'reminder_minutes', type: 'int', def: 30 }
];

class MeetingSettingsModel {
  static key(name) { return 'meeting.' + name; }

  static defaults() {
    const o = {};
    FIELDS.forEach((f) => { o[f.key] = f.def; });
    return o;
  }

  /**
   * Get meeting settings for the current company (with defaults).
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<object>}
   */
  static getSettings(user) {
    return new Promise((resolve, reject) => {
      if (!user.company_id) return resolve(MeetingSettingsModel.defaults());
      const sql = "SELECT setting_key, setting_value FROM system_settings WHERE company_id = ? AND setting_key LIKE 'meeting.%'";
      db.all(sql, [user.company_id], (err, rows) => {
        if (err) {
          logger.error('Model(MeetingSettingsModel): Error fetching settings:', err);
          return reject(err);
        }
        const s = MeetingSettingsModel.defaults();
        (rows || []).forEach((r) => {
          const name = r.setting_key.replace('meeting.', '');
          const f = FIELDS.find((x) => x.key === name);
          if (!f) return;
          const v = r.setting_value;
          if (f.type === 'bool') s[name] = (String(v) === '1');
          else if (f.type === 'int') s[name] = parseInt(v, 10) || 0;
          else s[name] = v;
        });
        resolve(s);
      });
    });
  }

  /**
   * Get meeting-related counts. Company-scoped for admins.
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<object>}
   */
  static getStats(user) {
    return (async () => {
      const isAdmin = user.role_name === 'admin' && user.company_id;
      const cid = user.company_id;
      const run = (sql, params) => new Promise((res, rej) =>
        db.get(sql, params, (err, row) => err ? rej(err) : res(row || {})));
      const companyJoin = (alias) => isAdmin
        ? ' JOIN users u ON LOWER(u.email) = LOWER(' + alias + '.calendar_account) AND u.company_id = ?'
        : '';
      const cparams = isAdmin ? [cid] : [];

      let sql = 'SELECT COUNT(*) c FROM meetings m' + companyJoin('m');
      const totalMeetings = (await run(sql, cparams)).c || 0;

      sql = 'SELECT COUNT(*) c FROM meetings m' + companyJoin('m') + ' WHERE m.scheduled_start_time >= NOW()';
      const upcomingMeetings = (await run(sql, cparams)).c || 0;

      sql = 'SELECT COUNT(*) c FROM meetings m' + companyJoin('m') + ' WHERE m.scheduled_start_time < NOW()';
      const completedMeetings = (await run(sql, cparams)).c || 0;

      sql = 'SELECT COUNT(*) c FROM meeting_sessions ms JOIN meetings m ON m.id = ms.meeting_id' + (isAdmin ? ' JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account) AND u.company_id = ?' : '');
      const totalSessions = (await run(sql, isAdmin ? [cid] : [])).c || 0;

      sql = 'SELECT COUNT(*) c FROM meeting_scores ms2 JOIN meetings m ON m.id = ms2.meeting_id' + (isAdmin ? ' JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account) AND u.company_id = ?' : '');
      const totalReviews = (await run(sql, isAdmin ? [cid] : [])).c || 0;

      sql = "SELECT COUNT(*) c FROM users u JOIN roles r ON r.id = u.role_id WHERE u.is_deleted = 0 AND r.role_name = 'instructor'" + (isAdmin ? ' AND u.company_id = ?' : '');
      const instructorCount = (await run(sql, isAdmin ? [cid] : [])).c || 0;

      sql = "SELECT COUNT(*) c FROM users u JOIN roles r ON r.id = u.role_id WHERE u.is_deleted = 0 AND r.role_name = 'reviewer'" + (isAdmin ? ' AND u.company_id = ?' : '');
      const reviewerCount = (await run(sql, isAdmin ? [cid] : [])).c || 0;

      return { totalMeetings, upcomingMeetings, completedMeetings, totalSessions, totalReviews, instructorCount, reviewerCount };
    })();
  }

  /**
   * Persist meeting settings (upsert each meeting.<field>).
   * @param {object} user - { company_id }
   * @param {object} settings - fields to update
   * @returns {Promise<object>} { updated }
   */
  static async updateSettings(user, settings) {
    if (!user.company_id) return { updated: false };
    const updates = [];
    FIELDS.forEach((f) => {
      let val;
      if (settings[f.key] === undefined) val = f.def;
      else if (f.type === 'bool') val = settings[f.key] ? '1' : '0';
      else val = String(settings[f.key]);
      updates.push(SystemSettingsModel.upsertSetting(user.company_id, MeetingSettingsModel.key(f.key), val, 'string'));
    });
    await Promise.all(updates);
    return { updated: true };
  }

}

module.exports = MeetingSettingsModel;
