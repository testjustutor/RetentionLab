/**
 * controllers/scores/scoresController.js
 * Scores controller
 */
const RubricModel = require('../../models/rubrics/RubricModel');
const MeetingSessionScoresModel = require('../../models/meetings/MeetingSessionScoresModel');
const UsersModel = require('../../models/users/UsersModel');
const MeetingModel = require('../../models/meetings/MeetingModel');
const { db } = require('../../database/db');

const controller = {
  async bulkSave(req, res) {
    try {
      const { meetingId, scores } = req.body;
      if (!meetingId || !Array.isArray(scores)) {
        return res.status(400).json({ error: 'meetingId and scores[] required' });
      }
      await RubricModel.saveMeetingScores(meetingId, scores);
      res.json({ saved: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async sessionUpsert(req, res) {
    try {
      const { meeting_id, session_id, indicator_id, score, comment } = req.body;
      if (!meeting_id || session_id === undefined || !indicator_id) {
        return res.status(400).json({ error: 'meeting_id, session_id, and indicator_id are required' });
      }
      const result = await MeetingSessionScoresModel.upsertScore({
        meeting_id,
        session_id: parseInt(session_id),
        indicator_id,
        reviewer_id: req.user.id,
        score: score ?? 0,
        comment: comment || null,
        score_type: 'MANUAL'
      });
      res.status(201).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async sessionGet(req, res) {
    try {
      const { meetingId, sessionId } = req.params;
      const rows = await MeetingSessionScoresModel.getScoresBySession(meetingId, parseInt(sessionId));
      res.json({ count: rows.length, data: rows, success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async sessionDelete(req, res) {
    try {
      const { meetingId, sessionId } = req.params;
      const result = await MeetingSessionScoresModel.clearSessionScoresBySession(meetingId, sessionId);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async meetingDelete(req, res) {
    try {
      const { meetingId } = req.params;
      const result = await MeetingSessionScoresModel.clearSessionScoresByMeeting(meetingId);
      res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async list(req, res) {
    try {
      const days = parseInt(req.query.days) || 90;
      const scores = await MeetingSessionScoresModel.getAllScoresWithDetails(days);
      res.json({ scores });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  /** POST /api/evaluation/instructors — List instructors for filter */
  async getInstructors(req, res) {
    try {
      const result = await UsersModel.listUsers(req.user, { 
        role: 'instructor',
        limit: 100 
      });
      const instructors = (result.rows || []).filter(u => (u.role_name || '').toLowerCase() === 'instructor');
      res.json({ instructors });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  /** GET /api/scores/sessions/:instructorId — Get sessions for instructor */
  async getSessionsByInstructor(req, res) {
    try {
      const instructorId = parseInt(req.params.instructorId);
      if (!instructorId) return res.status(400).json({ error: 'Instructor ID required' });

      // Get instructor's email
      const instructor = await new Promise((resolve, reject) => {
        db.get('SELECT email FROM users WHERE id = ?', [instructorId], (err, row) => err ? reject(err) : resolve(row));
      });

      if (!instructor) return res.status(404).json({ error: 'Instructor not found' });

      // Get sessions for this instructor's meetings
      const sessions = await new Promise((resolve, reject) => {
        db.all(
          `SELECT DISTINCT ms.id as session_id, ms.meeting_id, m.title as meeting_title, 
                  ms.start_time, ms.end_time, ms.transcript_file_name
           FROM meeting_sessions ms
           JOIN meetings m ON m.id = ms.meeting_id
           WHERE LOWER(m.calendar_account) = LOWER(?)
           AND ms.start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
           ORDER BY ms.start_time DESC
           LIMIT 50`,
          [instructor.email],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });

      res.json({ sessions });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  /** POST /api/evaluation/reviewers — List reviewers */
  async getReviewers(req, res) {
    try {
      const result = await UsersModel.listUsers(req.user, { limit: 100 });
      const users = result.rows || [];
      const reviewers = users.filter(u => (u.role_name || '').toLowerCase() === 'reviewer');
      res.json({ reviewers });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  /** POST /api/scores/filtered — Get filtered scores with category structure */
  async getFilteredScores(req, res) {
    try {
      const { from_date, to_date, instructor_id, session_id, reviewer_id, search, page = 1, per_page = 50 } = req.body;
      
      let sql = `
        SELECT ms.*, m.title as meeting_title, m.scheduled_start_time as meeting_date,
               CONCAT(u.first_name, ' ', u.last_name) as reviewer_name,
               u.id as reviewer_id,
               i.name as indicator_name, i.category_id,
               c.name as category_name, c.weight as category_weight
        FROM meeting_session_scores ms
        JOIN meeting_sessions msess ON msess.id = ms.session_id
        JOIN meetings m ON m.id = msess.meeting_id
        JOIN users u ON u.id = ms.reviewer_id
        JOIN rubric_indicators i ON i.indicator_id = ms.indicator_id
        JOIN rubric_categories c ON c.category_id = i.category_id
        WHERE 1=1
      `;
      const params = [];

      // Filter by date range
      if (from_date) {
        sql += ' AND ms.created_at >= ?';
        params.push(from_date + ' 00:00:00');
      }

      if (to_date) {
        sql += ' AND ms.created_at <= ?';
        params.push(to_date + ' 23:59:59');
      }

      // Filter by instructor (via meeting calendar_account)
      if (instructor_id) {
        const instructor = await new Promise((resolve, reject) => {
          db.get('SELECT email FROM users WHERE id = ?', [instructor_id], (err, row) => err ? reject(err) : resolve(row));
        });
        if (instructor) {
          sql += ' AND LOWER(m.calendar_account) = LOWER(?)';
          params.push(instructor.email);
        }
      }

      // Filter by session
      if (session_id) {
        sql += ' AND ms.session_id = ?';
        params.push(parseInt(session_id));
      }

      // Filter by reviewer
      if (reviewer_id) {
        sql += ' AND ms.reviewer_id = ?';
        params.push(parseInt(reviewer_id));
      }

      // Search filter
      if (search) {
        sql += ' AND (m.title LIKE ? OR i.name LIKE ? OR c.name LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Get total count
      const countSql = sql.replace('SELECT ms.*, m.title as meeting_title, m.scheduled_start_time as meeting_date, CONCAT(u.first_name, \' \', u.last_name) as reviewer_name, u.id as reviewer_id, i.name as indicator_name, i.category_id, c.name as category_name, c.weight as category_weight', 'SELECT COUNT(*) as total');
      const countRow = await new Promise((resolve, reject) => {
        db.get(countSql, params, (err, row) => err ? reject(err) : resolve(row || { total: 0 }));
      });
      const totalCount = countRow.total;

      // Add pagination
      const offset = (page - 1) * per_page;
      sql += ' ORDER BY c.name ASC, i.name ASC, ms.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(per_page), parseInt(offset));

      const rows = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      // Group by category
      const byCategory = {};
      rows.forEach(score => {
        const catKey = score.category_id;
        if (!byCategory[catKey]) {
          byCategory[catKey] = {
            category_id: score.category_id,
            category_name: score.category_name,
            category_weight: score.category_weight,
            indicators: {}
          };
        }
        const indKey = score.indicator_id;
        if (!byCategory[catKey].indicators[indKey]) {
          byCategory[catKey].indicators[indKey] = {
            indicator_id: score.indicator_id,
            indicator_name: score.indicator_name,
            scores: []
          };
        }
        byCategory[catKey].indicators[indKey].scores.push(score);
      });

      const categories = Object.values(byCategory);
      const totalPages = Math.ceil(totalCount / per_page) || 1;
      const message = totalCount === 0 ? 'No scores found for the selected filters' : `${totalCount} score(s) found`;

      res.json({ 
        success: true, 
        categories, 
        totalCount,
        totalPages,
        currentPage: parseInt(page),
        perPage: parseInt(per_page),
        message,
        statusCode: 200 
      });
    } catch (err) { res.status(500).json({ error: err.message, statusCode: 500 }); }
  }
};

module.exports = controller;