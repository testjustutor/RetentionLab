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

        logger.info("GoogleMeetAdapter(audioRecorderBot): Bot joined meeting. Browser session is active.");

        /**
         * NOTE: Removed the spawn('ffmpeg') block from here.
         * The recording is now handled by SocraticBot calling AudioRecorder.js
         * to avoid multiple processes trying to hook the same audio driver.
         */
    }

    async transcribeAudio(filePath) {
        if (!fs.existsSync(filePath)) {
            logger.error(`Transcription failed: File not found at ${filePath}`);
            return null;
        }

        const providers = [...new Set([settings.ai.provider, 'openai', 'groq'])].filter(p => p);

        for (const provider of providers) {
            try {
                logger.info(`Attempting transcription with: ${provider.toUpperCase()}`);

                const formData = new FormData();
                // Use fs.createReadStream for large files to keep memory usage low
                formData.append('file', fs.createReadStream(filePath));

                let apiUrl, apiKey, modelName;

                if (provider === 'openai') {
                    apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
                    apiKey = settings.ai.openaiApiKey;
                    modelName = 'whisper-1';
                } else if (provider === 'groq') {
                    apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
                    apiKey = settings.ai.groqApiKey;
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

                logger.info(`✅ ${provider.toUpperCase()} Transcription Success!`);
                return response.data.text;

            } catch (error) {
                const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
                logger.warn(`${provider.toUpperCase()} failed: ${errorMsg}. Trying next provider...`);
            }
        }

        logger.error("CRITICAL: All transcription providers failed.");
        return null;
    }

    async generateSummary(audioText, labeledText) {
        // 1. Safety check from Version 1
        if (!audioText || audioText.trim().length < 5) {
            logger.warn('Summary skipped: Transcript too short.');
            return 'Transcript too short for summary.';
        }

        // 2. Define the provider queue (Priority first, then backups)
        const primary = settings.ai.provider;
        const fallbacks = ['openai', 'groq', 'gemini'].filter(p => p !== primary);
        const providerQueue = [primary, ...fallbacks];

        const systemPrompt = `
            You are a professional meeting assistant. 
            Rules:
            1. Create concise meeting summary
            2. List key discussion points
            3. List action items
            4. Use Labeled Captions to identify speaker names
            5. Ignore separator/header/footer lines
        `;

        const userPrompt = `Audio Transcript: ${audioText}\n\nLabeled Captions: ${(labeledText || '').slice(0, 12000)}`;

        // 3. Failover Loop
        for (const provider of providerQueue) {
            try {
                logger.info(`Generating Summary with: ${provider.toUpperCase()}`);
                
                let response;
                let config = { timeout: 60000, headers: { 'Content-Type': 'application/json' } };

                if (provider === 'openai') {
                    config.headers.Authorization = `Bearer ${settings.ai.openaiApiKey}`;
                    response = await axios.post('https://api.openai.com/v1/chat/completions', {
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                        temperature: 0.3
                    }, config);
                } 
                else if (provider === 'groq') {
                    config.headers.Authorization = `Bearer ${settings.ai.groqApiKey}`;
                    response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                        model: 'llama3-8b-8192',
                        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                        temperature: 0.3
                    }, config);
                }
                else if (provider === 'gemini') {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.ai.geminiModel}:generateContent?key=${settings.ai.geminiApiKey}`;
                    response = await axios.post(url, {
                        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }]
                    }, config);
                }

                // Extract text based on provider format
                const finalText = response?.data?.choices?.[0]?.message?.content || 
                                 response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (finalText) return finalText;

            } catch (error) {
                logger.warn(`Provider ${provider} failed: ${error.message}. Trying next...`);
            }
        }

        return "Summary generation failed across all available providers.";
    }
}

module.exports = ProfessionalMeetingBot;