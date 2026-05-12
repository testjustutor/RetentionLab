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

router.get('/regenerate/:meetingId', async (req, res) => {
    try {
        const { meetingId } = req.params;
        const mode =
            req.query.mode || 'all';
        const session =
            await TranscriptModel.getSessionByMeetingId(meetingId);
        if (!session) {
            return res.status(404).json({
                status: 'error',
                message: `No record found for meeting ID: ${meetingId}`
            });
        }
        const ProfessionalMeetingBot = require('../services/audioRecorderBot');

        const processor = new ProfessionalMeetingBot(session.meeting_id);

        const audioPath = session.audio_file_name || null;

        const transcriptPath = session.transcript_file_name ? path.join(__dirname, '../storage/transcript', session.transcript_file_name )
                : null;

        let audioText = null;
        let transcriptText = null;

        let audioSummary = null;
        let transcriptSummary = null;
        let mergedSummary = null;

        let diarizedTranscript = null;

        const needsAudio = ['audio-transcript', 'audio-summary', 'merged-summary', 'all'].includes(mode);

        if (
            needsAudio &&
            audioPath &&
            fs.existsSync(audioPath)
        ) {

            logger.info(
                `Re-transcribing audio: ${meetingId}`
            );

            diarizedTranscript = await processor.diarizeAudio(audioPath);

            let finalTranscript = `
                    ==========================================
                    GOOGLE-MEET MEETING TRANSCRIPT
                    ==========================================
                    Meeting ID : ${meetingId}
                    Session ID : ${session.session_id}
                    Date       : ${new Date().toLocaleString()}
                    ==========================================

                    `;

            diarizedTranscript.forEach(item => {

                const time = new Date(item.start * 1000).toISOString().substr(11, 8);
                const speaker = item.speaker;
                finalTranscript +=  `[${time}] ${speaker}: ${item.text}  `;

            });

            finalTranscript += `==========================================
                              TRANSCRIPT ENDED: ${new Date().toLocaleString()}
                              ==========================================
                              `;

            const savePath = path.join( __dirname, '../storage/transcript', `TRANS_${meetingId}.txt` );
            await fs.promises.writeFile( savePath, finalTranscript, 'utf8');
            audioText = finalTranscript;
        }

        const needsTranscript = ['transcript-summary','merged-summary','all'].includes(mode);

        if (needsTranscript && transcriptPath && fs.existsSync(transcriptPath) ) {

            transcriptText =
                await fs.promises.readFile(
                    transcriptPath,
                    'utf8'
                );
        }

        if (
            ['audio-summary', 'all']
                .includes(mode) &&
            audioText
        ) {

            audioSummary =
                await processor.generateSummary(
                    audioText,
                    null
                );
        }

        if (
            ['transcript-summary', 'all']
                .includes(mode) &&
            transcriptText
        ) {

            transcriptSummary =
                await processor.generateSummary(
                    null,
                    transcriptText
                );
        }

        if (
            ['merged-summary', 'all']
                .includes(mode) &&
            (audioText || transcriptText)
        ) {

            mergedSummary =
                await processor.generateSummary(
                    audioText,
                    transcriptText
                );
        }

        return res.json({

            status: 'success',

            mode,

            meetingId,

            reprocessedAt:
                new Date().toISOString(),

            results: {

                audioTranscript:
                    audioText,

                diarizedTranscript,

                transcriptText,

                audioSummary,

                transcriptSummary,

                mergedSummary
            },

            filesUsed: {
                audio: audioPath,
                transcript: `TRANS_${meetingId}.txt`
            }
        });

    } catch (err) {

        logger.error(
            'Manual Browser Trigger Error:',
            err
        );

        return res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
});

router.get('/regeneratePyannote/:meetingId', async (req, res) => {
    try {
        const { meetingId } = req.params;
        
        // 1. Get session from DB
        const session = await TranscriptModel.getSessionByMeetingId(meetingId);
        if (!session) {
            return res.status(404).json({
                status: 'error',
                message: `No record found for meeting ID: ${meetingId}`
            });
        }

        const ProfessionalMeetingBot = require('../services/audioRecorderBot');
        const processor = new ProfessionalMeetingBot(session.meeting_id);
        const audioPath = session.audio_file_name;

        // 2. Validate Audio File exists
        if (!audioPath || !fs.existsSync(audioPath)) {
            return res.status(400).json({
                status: 'error',
                message: `Audio file not found at: ${audioPath}`
            });
        }

        logger.info(`[API] Regenerating Pyannote Transcript: ${meetingId}`);

        // 3. Run the Diarization (Python script)
        const diarizedSegments = await processor.diarizePyannoteAudio(audioPath);

        // 4. Format into a professional TXT layout
        let finalTranscript = `==========================================\n`;
        finalTranscript += `MEETING TRANSCRIPT (PYANNOTE PRO)\n`;
        finalTranscript += `Meeting ID : ${meetingId}\n`;
        finalTranscript += `Date       : ${new Date().toLocaleString()}\n`;
        finalTranscript += `==========================================\n\n`;

        diarizedSegments.forEach(item => {
            // Converts seconds to HH:MM:SS
            const timestamp = new Date(item.start * 1000).toISOString().substr(11, 8);
            finalTranscript += `[${timestamp}] ${item.speaker}: ${item.text}\n`;
        });

        finalTranscript += `\n==========================================\n`;
        finalTranscript += `TRANSCRIPT ENDED\n`;
        finalTranscript += `==========================================`;

        // 5. Save the file to storage
        const fileName = `TRANS_PRO_${meetingId}.txt`;
        const savePath = path.join(__dirname, '../storage/transcript', fileName);
        
        // Ensure directory exists
        if (!fs.existsSync(path.dirname(savePath))) {
            fs.mkdirSync(path.dirname(savePath), { recursive: true });
        }

        await fs.promises.writeFile(savePath, finalTranscript, 'utf8');

        // 6. Return response
        return res.json({
            status: 'success',
            meetingId,
            file: fileName,
            transcript: finalTranscript,
            rawSegments: diarizedSegments
        });

    } catch (err) {
        logger.error('[API] Pyannote Regeneration Error:', err);
        return res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
});


module.exports = router;
