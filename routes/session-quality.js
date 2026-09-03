/**
 * Session Quality Report Routes
 * Handles dashboard, filters, and report endpoints
 */

const express = require('express');
const router = express.Router();
const sessionQualityController = require('../controllers/session-quality/sessionQualityController');
const sessionQualityFilterController = require('../controllers/session-quality/sessionQualityFilterController');

/**
 * @route   GET /api/tutoring/dashboard
 * @desc    Get dashboard data with filters
 * @access  Public (add auth middleware if needed)
 */
router.get('/dashboard', sessionQualityController.getDashboard);

/**
 * @route   GET /api/tutoring/filters/options
 * @desc    Get filter options for a specific field
 * @access  Public (add auth middleware if needed)
 */
router.get('/filters/options', sessionQualityController.getFilterOptions);

/**
 * @route   GET /api/tutoring/report/:meetingId
 * @desc    Get aggregate report for a specific meeting
 * @access  Public (add auth middleware if needed)
 */
router.get('/report/:meetingId', sessionQualityController.getAggregateReport);

/**
 * @route   GET /api/tutoring/filters/instructors
 * @desc    Get list of instructors/teachers
 */
router.get('/filters/instructors', sessionQualityFilterController.getInstructors);

/**
 * @route   GET /api/tutoring/filters/boards
 * @desc    Get list of boards/curricula, optionally filtered by instructor
 */
router.get('/filters/boards', sessionQualityFilterController.getBoards);

/**
 * @route   GET /api/tutoring/filters/classes
 * @desc    Get list of classes/grades, optionally filtered by instructor and/or board
 */
router.get('/filters/classes', sessionQualityFilterController.getClasses);

/**
 * @route   GET /api/tutoring/filters/subjects
 * @desc    Get list of subjects, optionally filtered by instructor, board, and/or class
 */
router.get('/filters/subjects', sessionQualityFilterController.getSubjects);

/**
 * @route   GET /api/tutoring/filters/meetings
 * @desc    Get list of meetings, optionally filtered by instructor, board, class, and/or subject
 */
router.get('/filters/meetings', sessionQualityFilterController.getMeetings);

module.exports = router;
