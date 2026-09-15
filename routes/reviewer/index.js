/**
 * routes/reviewer/index.js
 * MAIN Reviewer route file — consolidates every Reviewer API route, only CALLS
 * sub-routers/controllers. No business logic here.
 * Mounted in routes/registry.js at /api/reviewer (handler 'reviewer').
 *
 * Replaces the old flat mounts:
 *   /api/reviewer-dashboard  -> /api/reviewer/dashboard
 *   /api/reviewer-sessions   -> /api/reviewer/sessions
 *   /api/reviewer-reviews    -> /api/reviewer/reviews
 *   /api/reviewer-scores     -> /api/reviewer/scores
 *   /api/tutor-evaluation    -> /api/reviewer/evaluations
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');

router.use('/dashboard', require('./dashboard'));
router.use('/sessions', require('./sessions'));
router.use('/reviews', require('./reviews'));
router.use('/scores', require('./scores'));
router.use('/evaluations', require('./evaluations'));
router.use('/profile', requireAuth, require('./profile'));

module.exports = router;
