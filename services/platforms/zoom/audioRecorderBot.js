/**
 * services/platforms/zoom/audioRecorderBot.js
 *
 */
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data'); // Fixed: Ensure FormData is imported for Node.js
const BrowserManager = require('../../shared/browserManager');
const { logger } = require('../../../utils/logger');
const settings = require('../../../config/settings');

class ProfessionalMeetingBot {
    constructor(meetingUrl) {
        this.meetingUrl = meetingUrl;
        this.browserManager = null;
        this.page = null;
    }

    async start() {
        this.browserManager = new BrowserManager();
        
        // Initialize browser with necessary flags for audio processing
        await this.browserManager.init({ 
            userDataDir: './user_data',
            // Ensure these args are passed in your BrowserManager.js:
            // ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream']
        });

        this.page = this.browserManager.page; 
        
        // Navigate to the meeting
        await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });

        logger.info("ZoomAdapter(audioRecorderBot): Bot joined meeting. Browser session is active.");
        
        /**
         * NOTE: Removed the spawn('ffmpeg') block from here.
         * The recording is now handled by SocraticBot calling AudioRecorder.js
         * to avoid multiple processes trying to hook the same audio driver.
         */
    }

    async transcribeAudio(filePath) {
        if (!fs.existsSync(filePath)) {
            logger.error(`ZoomAdapter(audioRecorderBot): File not found for transcription: ${filePath}`);
            return null;
        }

        // 1. Define your backup order
        const priorityList = [settings.ai.provider, 'openai', 'cloude'];
        const providers = [...new Set(priorityList)].filter(p => p);

        // 2. Loop through each one
        for (const provider of providers) {
            try {
                logger.info(`ZoomAdapter(audioRecorderBot): Attempting zoom transcription with: ${provider.toUpperCase()}`);
                
                const formData = new FormData();
                formData.append('file', fs.createReadStream(filePath));

                let apiUrl, apiKey, modelName;

                // 3. Setup the specific provider details
                if (provider === 'openai') {
                    apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
                    apiKey = settings.ai.openaiApiKey;
                    modelName = 'whisper-1';
                } else if (provider === 'cloude') {
                    apiUrl = 'https://api.cloude.com/openai/v1/audio/transcriptions';
                    apiKey = settings.ai.cloudeApiKey;
                    modelName = 'whisper-large-v3';
                } else {
                    continue; // Skip if unknown
                }

                formData.append('model', modelName);

                // 4. Try the request
                const response = await axios.post(apiUrl, formData, {
                    headers: { 
                        ...formData.getHeaders(),
                        'Authorization': `Bearer ${apiKey}` 
                    },
                    timeout: 60000 // 1 minute timeout
                });

                // If we reach here, it worked!
                logger.info(`ZoomAdapter(audioRecorderBot): ${provider.toUpperCase()} Success!`);
                return response.data.text;

            } catch (error) {
                // 5. IMPORTANT: DO NOT THROW HERE
                // We just log the error and let the 'for' loop continue to the next provider
                const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
                logger.warn(`ZoomAdapter(audioRecorderBot): ${provider.toUpperCase()} failed: ${errorMsg}. Continuing to next provider...`);
            }
        }

        // 6. Only reach here if EVERY provider in the list failed
        logger.error("ZoomAdapter(audioRecorderBot): ALL transcription providers failed. Saving audio for manual retry.");
        return null; 
    }

    async generateSummary(audioText, labeledText) {
        const providers = [...new Set([settings.ai.provider, 'cloude', 'openai'])].filter(p => p);

        for (const provider of providers) {
            try {
                logger.info(`ZoomAdapter(audioRecorderBot): Generating Summary with: ${provider.toUpperCase()}`);
                
                let apiUrl, apiKey, model;
                if (provider === 'openai') {
                    apiUrl = 'https://api.openai.com/v1/chat/completions';
                    apiKey = settings.ai.openaiApiKey;
                    model = settings.ai.openaiModel;
                } else {
                    apiUrl = 'https://api.cloude.com/openai/v1/chat/completions';
                    apiKey = settings.ai.cloudeApiKey;
                    model = settings.ai.anthropicModel;
                }

                const response = await axios.post(apiUrl, {
                    model: model,
                    messages: [
                        { 
                            role: "system", 
                            content: "You are a professional meeting assistant. Use the provided high-quality audio transcript for facts and the labeled caption text to identify who said what." 
                        },
                        { 
                            role: "user", 
                            content: `Audio Transcript: ${audioText}\n\nLabeled Captions: ${labeledText}` 
                        }
                    ]
                }, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });

                return response.data.choices[0].message.content;
            } catch (error) {
                logger.warn(`ZoomAdapter(audioRecorderBot): Summary failed with ${provider}, trying next...`);
            }
        }
        return "Summary generation failed across all providers.";
    }
}

module.exports = ProfessionalMeetingBot;