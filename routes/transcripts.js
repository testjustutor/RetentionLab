const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const TranscriptModel = require('../models/transcriptModel');

const { generateCSV, generateTXT } = require('../utils/transcriptUtils');

const fs = require('fs');
const path = require('path');

router.get('/', async (req, res) => {
  try {
    const { meetingId, sessionId, speaker, limit = 100, offset = 0 } = req.query;

    let transcripts = [];

    if (meetingId) {
      transcripts = await TranscriptModel.getTranscriptsByMeeting(meetingId);
    } else if (sessionId) {
      transcripts = await TranscriptModel.getTranscriptsBySession(sessionId);
    }

    // Filter by speaker if provided
    if (speaker) {
      transcripts = transcripts.filter(t => 
        t.speaker.toLowerCase().includes(speaker.toLowerCase())
      );
    }

    // Pagination
    const total = transcripts.length;
    const paginatedTranscripts = transcripts.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      status: 'success',
      data: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        transcripts: paginatedTranscripts
      }
    });
  } catch (err) {
    logger.error('Route(transcripts): Error fetching transcripts:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const transcripts = await TranscriptModel.getTranscriptsBySession(sessionId);

    res.json({
      status: 'success',
      data: {
        sessionId,
        count: transcripts.length,
        transcripts
      }
    });
  } catch (err) {
    logger.error('Route(transcripts): Error fetching session transcripts:', err);

    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/meeting/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const transcripts = await TranscriptModel.getTranscriptsByMeeting(meetingId);

    if (!transcripts.length) {
      return res.status(404).json({ status: 'error', message: 'No transcripts found for this meeting' });
    }

    res.json({
      status: 'success',
      data: {
        meetingId,
        count: transcripts.length,
        transcripts
      }
    });
  } catch (err) {
    logger.error('Route(transcripts): Error fetching meeting transcripts:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/search', async (req, res) => {
  try {
    const { query, meetingId, fields = ['speaker', 'text'], limit = 50 } = req.body;

    if (!query) {
      return res.status(400).json({ status: 'error', message: 'Query is required' });
    }

    let transcripts = [];
    if (meetingId) {
      transcripts = await TranscriptModel.getTranscriptsByMeeting(meetingId);
    } else {
      transcripts = await TranscriptModel.getAllTranscripts();
    }

    const queryLower = query.toLowerCase();
    const results = transcripts.filter(t => {
      return fields.some(field => 
        String(t[field] || '').toLowerCase().includes(queryLower)
      );
    }).slice(0, limit);

    res.json({
      status: 'success',
      data: {
        query,
        found: results.length,
        results
      }
    });
  } catch (err) {
    logger.error('Route(transcripts): Error searching transcripts:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/export/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format = 'json' } = req.query;

    const transcripts = await TranscriptModel.getTranscriptsBySession(sessionId);

    if (!transcripts.length) {
      return res.status(404).json({ status: 'error', message: 'No transcripts found' });
    }

    let output;
    let contentType;
    let filename = `transcript-${sessionId}`;

    switch (format.toLowerCase()) {
      case 'csv':
        output = generateCSV(transcripts);
        contentType = 'text/csv';
        filename += '.csv';
        break;

      case 'txt':
        output = generateTXT(transcripts);
        contentType = 'text/plain';
        filename += '.txt';
        break;

      case 'json':
      default:
        output = JSON.stringify(transcripts, null, 2);
        contentType = 'application/json';
        filename += '.json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(output);
  } catch (err) {
    logger.error('Route(transcripts): Error exporting transcript:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/stats/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const transcripts = await TranscriptModel.getTranscriptsByMeeting(meetingId);

    const stats = {
      totalTranscripts: transcripts.length,
      uniqueSpeakers: [...new Set(transcripts.map(t => t.speaker))].length,
      speakers: {},
      totalWords: 0,
      averageMessageLength: 0
    };

    transcripts.forEach(t => {
      if (!stats.speakers[t.speaker]) {
        stats.speakers[t.speaker] = { messages: 0, words: 0 };
      }
      const wordCount = (t.text || '').split(/\s+/).length;
      stats.speakers[t.speaker].messages++;
      stats.speakers[t.speaker].words += wordCount;
      stats.totalWords += wordCount;
    });

    stats.averageMessageLength = stats.totalTranscripts > 0 
      ? Math.round(stats.totalWords / stats.totalTranscripts) 
      : 0;

    res.json({
      status: 'success',
      data: stats
    });
  } catch (err) {
    logger.error('Route(transcripts): Error getting transcript stats:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
