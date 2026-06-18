/**
 * root/routes/participants.js
 * Endpoints for participants, participant sessions, attendance, and AI audit results
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');

const ParticipantsModel = require('../models/ParticipantsModel');
const ParticipantSessionsModel = require('../models/ParticipantSessionsModel');
const ParticipantAttendanceSessionsModel = require('../models/ParticipantAttendanceSessionsModel');
const AIAuditResultsModel = require('../models/AIAuditResultsModel');

function requireFields(body, fields) {
  const missing = [];
  for (const f of fields) if (body[f] === undefined || body[f] === null) missing.push(f);
  return missing;
}

// Participants
router.post('/', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => {
  try {
    const missing = requireFields(req.body, ['meeting_id','participant_name']);
    if (missing.length) return res.status(400).json({ error: 'Missing fields', missing });
    const r = await ParticipantsModel.create(req.body); res.status(201).json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/meeting/:meetingId', requireAuth, async (req, res) => { try { const rows = await ParticipantsModel.getByMeeting(req.params.meetingId); res.json({ count: rows.length, data: rows }); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/:id', requireAuth, async (req, res) => { try { const row = await ParticipantsModel.getById(req.params.id); if (!row) return res.status(404).json({ error: 'Not found' }); res.json(row); } catch (err) { res.status(500).json({ error: err.message }); } });
router.put('/:id', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const r = await ParticipantsModel.update(req.params.id, req.body); res.json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.delete('/:id', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const r = await ParticipantsModel.delete(req.params.id); res.json(r); } catch (err) { res.status(500).json({ error: err.message }); } });

// Participant sessions
router.post('/sessions', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => { try { const missing = requireFields(req.body, ['meeting_id','session_id','participant_name']); if (missing.length) return res.status(400).json({ error: 'Missing fields', missing }); const r = await ParticipantSessionsModel.create(req.body); res.status(201).json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/sessions/meeting/:meetingId', requireAuth, async (req, res) => { try { const rows = await ParticipantSessionsModel.listByMeeting(req.params.meetingId); res.json({ count: rows.length, data: rows }); } catch (err) { res.status(500).json({ error: err.message }); } });
router.put('/sessions/:id', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const r = await ParticipantSessionsModel.update(req.params.id, req.body); res.json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.delete('/sessions/:id', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const r = await ParticipantSessionsModel.delete(req.params.id); res.json(r); } catch (err) { res.status(500).json({ error: err.message }); } });

// Attendance sessions
router.post('/attendance', requireAuth, requireRole('reviewer','admin','super_admin'), async (req, res) => { try { const missing = requireFields(req.body, ['meeting_id','participant_id','session_number']); if (missing.length) return res.status(400).json({ error: 'Missing fields', missing }); const r = await ParticipantAttendanceSessionsModel.create(req.body); res.status(201).json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/attendance/participant/:participantId', requireAuth, async (req, res) => { try { const rows = await ParticipantAttendanceSessionsModel.listByParticipant(req.params.participantId); res.json({ count: rows.length, data: rows }); } catch (err) { res.status(500).json({ error: err.message }); } });
router.put('/attendance/:id', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const r = await ParticipantAttendanceSessionsModel.update(req.params.id, req.body); res.json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.delete('/attendance/:id', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const r = await ParticipantAttendanceSessionsModel.delete(req.params.id); res.json(r); } catch (err) { res.status(500).json({ error: err.message }); } });

// AI audit results
router.post('/ai-audit', requireAuth, requireRole('admin','super_admin'), async (req, res) => { try { const missing = requireFields(req.body, ['meeting_id','session_id','indicator_id']); if (missing.length) return res.status(400).json({ error: 'Missing fields', missing }); const r = await AIAuditResultsModel.upsert(req.body); res.status(201).json(r); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/ai-audit/:meetingId', requireAuth, async (req, res) => { try { const rows = await AIAuditResultsModel.getByMeeting(req.params.meetingId); res.json({ count: rows.length, data: rows }); } catch (err) { res.status(500).json({ error: err.message }); } });

module.exports = router;
