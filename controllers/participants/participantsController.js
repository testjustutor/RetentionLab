/**
 * controllers/participants/participantsController.js
 * Participants controller
 */
const ParticipantsModel = require('../../models/participants/ParticipantsModel');
const ParticipantSessionsModel = require('../../models/participants/ParticipantSessionsModel');
const ParticipantAttendanceSessionsModel = require('../../models/participants/ParticipantAttendanceSessionsModel');
const AIAuditResultsModel = require('../../models/audit/AIAuditResultsModel');

function requireFields(body, fields) {
  const missing = [];
  for (const f of fields) if (body[f] === undefined || body[f] === null) missing.push(f);
  return missing;
}

const controller = {
  // Participants
  async create(req, res) {
    try {
      const missing = requireFields(req.body, ['meeting_id', 'participant_name']);
      if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
      const r = await ParticipantsModel.create(req.body);
      res.status(201).json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getByMeeting(req, res) {
    try {
      const rows = await ParticipantsModel.getByMeeting(req.params.meetingId);
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getById(req, res) {
    try {
      const row = await ParticipantsModel.getById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async update(req, res) {
    try {
      const r = await ParticipantsModel.update(req.params.id, req.body);
      res.json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async delete(req, res) {
    try {
      const r = await ParticipantsModel.delete(req.params.id);
      res.json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  // Sessions
  async createSession(req, res) {
    try {
      const missing = requireFields(req.body, ['meeting_id', 'session_id', 'participant_name']);
      if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
      const r = await ParticipantSessionsModel.create(req.body);
      res.status(201).json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async listSessions(req, res) {
    try {
      const rows = await ParticipantSessionsModel.listByMeeting(req.params.meetingId);
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async updateSession(req, res) {
    try {
      const r = await ParticipantSessionsModel.update(req.params.id, req.body);
      res.json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async deleteSession(req, res) {
    try {
      const r = await ParticipantSessionsModel.delete(req.params.id);
      res.json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  // Attendance
  async createAttendance(req, res) {
    try {
      const missing = requireFields(req.body, ['meeting_id', 'participant_id', 'session_number']);
      if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
      const r = await ParticipantAttendanceSessionsModel.create(req.body);
      res.status(201).json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async listAttendance(req, res) {
    try {
      const rows = await ParticipantAttendanceSessionsModel.listByParticipant(req.params.participantId);
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async updateAttendance(req, res) {
    try {
      const r = await ParticipantAttendanceSessionsModel.update(req.params.id, req.body);
      res.json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async deleteAttendance(req, res) {
    try {
      const r = await ParticipantAttendanceSessionsModel.delete(req.params.id);
      res.json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  // AI Audit
  async createAiAudit(req, res) {
    try {
      const missing = requireFields(req.body, ['meeting_id', 'session_id', 'indicator_id']);
      if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
      const r = await AIAuditResultsModel.upsert(req.body);
      res.status(201).json(r);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getAiAudit(req, res) {
    try {
      const rows = await AIAuditResultsModel.getByMeeting(req.params.meetingId);
      res.json({ count: rows.length, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
};

module.exports = controller;