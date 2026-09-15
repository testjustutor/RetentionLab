/**
 * routes/reviewer/scores.js
 * Thin route layer for the reviewer scores report page.
 * Moved from routes/reviewer-scores.js (was mounted at /api/reviewer-scores);
 * now mounted by routes/reviewer/index.js at /scores (under /api/reviewer).
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const ctrl = require('../../controllers/reviewer/reviewerScoresController');

function handle(fn) {
  return (req, res) => fn(req).then(r => res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r));
}

router.get('/filter-options', requireAuth, handle(ctrl.getFilterOptions));
router.get('/report', requireAuth, handle(ctrl.getReport));

module.exports = router;
