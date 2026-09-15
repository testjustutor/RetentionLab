/**
 * services/platforms/google-meet/audioRecorderBot.js
 *
 */
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data'); // Fixed: Ensure FormData is imported for Node.js
const { logger } = require('../../../utils/logger');
const settings = require('../../../config/settings');
const PythonBridge = require('../../shared/pythonBridge');
const path = require('path');

class ProfessionalMeetingBot {
    constructor(meetingUrl) {
        this.meetingUrl = meetingUrl;
    }

    async runAuditPipeline(videoFilePath) {
        try {
            const fileName = path.basename(videoFilePath);
            logger.info(`GoogleMeetAdapter(audioRecorderBot): Handoff to PythonBridge: ${fileName}`);
            
            const result = await PythonBridge.runFullPipeline(fileName);
            return result;
        } catch (error) {
            logger.error(`GoogleMeetAdapter(audioRecorderBot): Audit Handoff failed: ${error.message}`);
            return null;
        }
    }

    async transcribeAudio(filePath, transcriptPath) {

        if (!fs.existsSync(filePath)) {
            logger.error(`GoogleMeetAdapter(audioRecorderBot): Audio File not found at ${filePath}`);
            return null;
        }

        // Optional: Log if we have the transcript path for context
        if (transcriptPath && fs.existsSync(transcriptPath)) {
            logger.info(`GoogleMeetAdapter(audioRecorderBot): Transcribing with speaker context from ${transcriptPath}`);
        }

        const providers = [...new Set([settings.ai.provider, 'openai', 'cloude'])].filter(p => p);

        for (const provider of providers) {
            try {
                logger.info(`GoogleMeetAdapter(audioRecorderBot): Attempting transcription with: ${provider.toUpperCase()}`);

                const formData = new FormData();
                // Use fs.createReadStream for large files to keep memory usage low
                formData.append('file', fs.createReadStream(filePath));

                let apiUrl, apiKey, modelName;

                if (provider === 'openai') {
                    apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
                    apiKey = settings.ai.openaiApiKey;
                    modelName = 'whisper-1';
                } else if (provider === 'cloude') {
                    apiUrl = 'https://api.cloude.com/openai/v1/audio/transcriptions';
                    apiKey = settings.ai.cloudeApiKey;
                    modelName = 'whisper-large-v3';
                } else {
                    continue;
                }

                formData.append('model', modelName);

                const response = await axios.post(apiUrl, formData, {
                    headers: {
                        ...formData.getHeaders(), // Ensure you are using the 'form-data' npm package
                        'Authorization': `Bearer ${apiKey}`
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                    timeout: 90000 // Increased to 90s (Whisper can be slow for long meetings)
                });

                logger.info(`GoogleMeetAdapter(audioRecorderBot): ${provider.toUpperCase()} Transcription Success!`);
                return response.data.text;

            } catch (error) {
                const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
                logger.warn(`GoogleMeetAdapter(audioRecorderBot): ${provider.toUpperCase()} failed: ${errorMsg}. Trying next provider...`);
            }
        }

        logger.error("GoogleMeetAdapter(audioRecorderBot): All transcription providers failed.");
        return null;
    }
}

module.exports = ProfessionalMeetingBot;
