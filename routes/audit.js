const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');
const TranscriptModel = require('../models/transcriptModel');

/**
 * @route   POST /api/audit/process/:meetingId
 * @desc    Triggers the Python Engine (Media -> AI -> Rubric)
 * @access  Protected
 */
router.post('/process/:meetingId', async (req, res) => {
    try {
        const { meetingId } = req.params;

        // 1. Fetch meeting metadata
        const session = await TranscriptModel.getSessionByMeetingId(meetingId);
        if (!session || !session.audio_file_name) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Recording not found for this meeting.' 
            });
        }

        // We pass only the filename; the Python Engine handles the root pathing
        const videoFileName = path.basename(session.audio_file_name);
        const bridgePath = path.join(__dirname, '../audit_bridge.py');

        logger.info(`[Engine] Initiating full audit for Meeting: ${meetingId}`);

        // 2. Execute Python Bridge
        // Command: python3 audit_bridge.py "filename.mp4"
        exec(`python3 "${bridgePath}" "${videoFileName}"`, async (error, stdout, stderr) => {
            if (error) {
                logger.error(`[Engine] Execution Error: ${stderr}`);
                return res.status(500).json({ 
                    status: 'error', 
                    message: 'AI Engine failed to process recording.' 
                });
            }

            const output = stdout.trim();
            
            // Check if Python returned the SUCCESS signal
            if (output.startsWith('SUCCESS')) {
                const [_, transcriptPath, auditPath] = output.split('|');

                // 3. Read the generated JSON Audit Report
                const reportRaw = fs.readFileSync(auditPath, 'utf8');
                const reportData = JSON.parse(reportRaw);

                // 4. Return the OQI and the Audit findings
                return res.json({
                    status: 'success',
                    data: {
                        meetingId,
                        oqi: reportData.oqi,
                        performance: reportData.results,
                        files: {
                            transcript: path.basename(transcriptPath),
                            report: path.basename(auditPath)
                        },
                        processedAt: new Date().toISOString()
                    }
                });
            } else {
                logger.error(`[Engine] Logic Error: ${output}`);
                return res.status(500).json({ status: 'error', message: output });
            }
        });

    } catch (err) {
        logger.error(`[Route:Audit] Internal Error: ${err.message}`);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * @route   GET /api/audit/report/:meetingId
 * @desc    Retrieves an existing audit report from storage
 */
router.get('/report/:meetingId', async (req, res) => {
    try {
        const { meetingId } = req.params;
        const reportPath = path.join(__dirname, '../storage/audits', `TRANS_${meetingId}.json`);

        if (!fs.existsSync(reportPath)) {
            return res.status(404).json({ status: 'error', message: 'Audit report not found.' });
        }

        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        res.json({ status: 'success', data: report });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;