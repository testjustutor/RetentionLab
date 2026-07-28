/**
 * root/routes/participants.js
 * Endpoints for participants, participant sessions, attendance, and AI audit results
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const participantsController = require('../controllers/participants/participantsController');

// Participants
router.post('/', requireAuth, requireRole('reviewer','admin','super_admin'), participantsController.create);
router.get('/meeting/:meetingId', requireAuth, participantsController.getByMeeting);
router.get('/:id', requireAuth, participantsController.getById);
router.put('/:id', requireAuth, requireRole('admin','super_admin'), participantsController.update);
router.delete('/:id', requireAuth, requireRole('admin','super_admin'), participantsController.delete);

// Participant sessions
router.post('/sessions', requireAuth, requireRole('reviewer','admin','super_admin'), participantsController.createSession);
router.get('/sessions/meeting/:meetingId', requireAuth, participantsController.listSessions);
router.put('/sessions/:id', requireAuth, requireRole('admin','super_admin'), participantsController.updateSession);
router.delete('/sessions/:id', requireAuth, requireRole('admin','super_admin'), participantsController.deleteSession);

// Attendance sessions
router.post('/attendance', requireAuth, requireRole('reviewer','admin','super_admin'), participantsController.createAttendance);
router.get('/attendance/participant/:participantId', requireAuth, participantsController.listAttendance);
router.put('/attendance/:id', requireAuth, requireRole('admin','super_admin'), participantsController.updateAttendance);
router.delete('/attendance/:id', requireAuth, requireRole('admin','super_admin'), participantsController.deleteAttendance);

// AI audit results
router.post('/ai-audit', requireAuth, requireRole('admin','super_admin'), participantsController.createAiAudit);
router.get('/ai-audit/:meetingId', requireAuth, participantsController.getAiAudit);

module.exports = router;