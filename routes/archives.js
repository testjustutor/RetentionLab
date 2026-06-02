const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const ArchivesModel = require('../models/ArchivesModel');

// POST /api/archives (accepts JSON body: { from, to, limit, search })

router.post('/', async (req, res) => {
  try {
    const {
      from,
      to,
      limit,
      q,
      search
    } = req.body || {};

    const nowIsoDate = new Date().toISOString();
    const limitNum = Number(limit) > 0 ? Number(limit) : 50;

    const fromDate = from ? new Date(from) : new Date(nowIsoDate);
    const toDate = to ? new Date(to) : new Date(nowIsoDate);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Invalid from/to date' });
    }

    const searchTerm = (search || q || '').toString().trim();

    const result = await ArchivesModel.getCompletedMeetingsWithTranscripts({
      limit: limitNum,
      from: fromDate,
      to: toDate,
      search: searchTerm
    });

    res.json({ status: 'success', meetings: result.meetings || [] });
  } catch (err) {
    logger.error('Route(archives)[POST]: Error fetching meetings:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;