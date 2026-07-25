/**
 * root/routes/reviewer-dashboard.js
 * Dashboard API for reviewers
 */
const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const MeetingReviewersModel = require('../models/reviewers/MeetingReviewersModel');
const MeetingScoresModel = require('../models/reviews/MeetingScoresModel');
const MeetingModel = require('../models/reports/MeetingModel');

// Get reviewer dashboard stats
router.get('/stats', requireAuth, requireRole('reviewer'), async (req, res) => {
  try {
    const reviewerId = req.user.id;
    
    // Get all reviews for this reviewer
    const reviews = await new Promise((resolve, reject) => {
      db.all(
        `SELECT mr.*, m.title as meeting_title, m.start_time 
         FROM meeting_reviewers mr
         JOIN meetings m ON mr.meeting_id = m.meeting_id
         WHERE mr.reviewer_id = ?`,
        [reviewerId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });

    // Calculate stats
    const pending = reviews.filter(r => r.review_status === 'pending');
    const inProgress = reviews.filter(r => r.review_status === 'in_progress');
    const completed = reviews.filter(r => r.review_status === 'completed');
    
    // Overdue reviews (assigned more than 7 days ago and not completed)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const overdue = pending.filter(r => new Date(r.assigned_at) < sevenDaysAgo);

    // Recently assigned (last 7 days)
    const recentlyAssigned = reviews.filter(r => new Date(r.assigned_at) > sevenDaysAgo);

    // Performance metrics
    const avgReviewTime = completed.length > 0 
      ? Math.round(completed.reduce((sum, r) => {
          if (!r.reviewed_at) return sum;
          const diff = new Date(r.reviewed_at) - new Date(r.assigned_at);
          return sum + diff / (1000 * 60 * 60); // hours
        }, 0) / completed.length)
      : 0;

    res.json({
      pending: pending.length,
      inProgress: inProgress.length,
      completed: completed.length,
      overdue: overdue.length,
      recentlyAssigned: recentlyAssigned.length,
      avgReviewTime: Math.round(avgReviewTime * 10) / 10, // hours with 1 decimal
      totalReviews: reviews.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent assignments
router.get('/recent-assignments', requireAuth, requireRole('reviewer'), async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const limit = req.query.limit || 5;
    
    const assignments = await new Promise((resolve, reject) => {
      db.all(
        `SELECT mr.*, m.title as meeting_title, m.start_time, m.platform
         FROM meeting_reviewers mr
         JOIN meetings m ON mr.meeting_id = m.meeting_id
         WHERE mr.reviewer_id = ?
         ORDER BY mr.assigned_at DESC
         LIMIT ?`,
        [reviewerId, parseInt(limit)],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get overdue reviews
router.get('/overdue', requireAuth, requireRole('reviewer'), async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const overdue = await new Promise((resolve, reject) => {
      db.all(
        `SELECT mr.*, m.title as meeting_title, m.start_time
         FROM meeting_reviewers mr
         JOIN meetings m ON mr.meeting_id = m.meeting_id
         WHERE mr.reviewer_id = ? 
         AND mr.review_status = 'pending'
         AND mr.assigned_at < ?
         ORDER BY mr.assigned_at ASC`,
        [reviewerId, sevenDaysAgo.toISOString()],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });

    res.json(overdue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get review performance metrics
router.get('/performance', requireAuth, requireRole('reviewer'), async (req, res) => {
  try {
    const reviewerId = req.user.id;
    
    // Get completed reviews with timing
    const completed = await new Promise((resolve, reject) => {
      db.all(
        `SELECT mr.*, m.title as meeting_title
         FROM meeting_reviewers mr
         JOIN meetings m ON mr.meeting_id = m.meeting_id
         WHERE mr.reviewer_id = ? AND mr.review_status = 'completed'
         ORDER BY mr.reviewed_at DESC`,
        [reviewerId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });

    // Calculate average completion time
    const avgTime = completed.length > 0
      ? Math.round(completed.reduce((sum, r) => {
          if (!r.reviewed_at) return sum;
          const diff = new Date(r.reviewed_at) - new Date(r.assigned_at);
          return sum + diff / (1000 * 60 * 60); // hours
        }, 0) / completed.length)
      : 0;

    // Reviews per week (last 8 weeks)
    const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
    const weeklyData = {};
    
    for (let i = 0; i < 8; i++) {
      const weekStart = new Date(eightWeeksAgo);
      weekStart.setDate(weekStart.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekKey = `Week ${i + 1}`;
      weeklyData[weekKey] = completed.filter(r => {
        const reviewedAt = new Date(r.reviewed_at);
        return reviewedAt >= weekStart && reviewedAt <= weekEnd;
      }).length;
    }

    res.json({
      totalCompleted: completed.length,
      averageCompletionTime: Math.round(avgTime * 10) / 10,
      weeklyReviews: weeklyData,
      recentReviews: completed.slice(0, 5).map(r => ({
        meeting_title: r.meeting_title,
        completed_at: r.reviewed_at,
        status: r.review_status
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;