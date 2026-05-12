const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data'); // Fixed: Ensure FormData is imported for Node.js
const BrowserManager = require('./browserManager');
const { logger } = require('../utils/logger');
const settings = require('../config/settings');
const { exec } = require('child_process');
const path = require('path');


class ProfessionalMeetingBot {

    constructor(meetingUrl) {
        this.meetingUrl = meetingUrl;
        this.browserManager = null;
        this.page = null;
    }

    async diarizePyannoteAudio(filePath) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../diarize_pyannote.py');
            const { spawn } = require('child_process');
            
            logger.info(`[AI] Spawning Pro Diarization: ${scriptPath}`);

            // Use spawn instead of exec for better Windows stability
            const pyProcess = spawn('python', [scriptPath, filePath], {
                env: { 
                    ...process.env, 
                    HF_TOKEN: settings.huggingFaceToken,
                    TORCHAUDIO_BACKEND: "soundfile",
                    PYTHONIOENCODING: "utf-8"
                }
            });

            let stdoutData = "";
            let stderrData = "";

            pyProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
                logger.info(`Python stdout: ${data.toString().trim()}`);
            });

            pyProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
                logger.warn(`Python stderr: ${data.toString().trim()}`);
            });

            pyProcess.on('close', (code) => {
                if (code !== 0) {
                    logger.error(`Python exited with code ${code}. Stderr: ${stderrData}`);
                    return reject(new Error(`Python script failed with code ${code}`));
                }

                try {
                    const startMarker = "---JSON_START---";
                    const endMarker = "---JSON_END---";
                    
                    if (stdoutData.includes(startMarker)) {
                        const jsonStr = stdoutData.split(startMarker)[1].split(endMarker)[0].trim();
                        resolve(JSON.parse(jsonStr));
                    } else {
                        reject(new Error("JSON markers not found in Python output"));
                    }
                } catch (err) {
                    reject(new Error(`Failed to parse Python JSON: ${err.message}`));
                }
            });
        });
    }

    async transcribePyannoteAudio(filePath) {
        if (!fs.existsSync(filePath)) {
            logger.error(`DefaultAdapter(audioRecorderBot): File not found for transcription: ${filePath}`);
            return null;
        }

        // 1. Define your backup order
        const priorityList = [settings.ai.provider, 'openai', 'groq'];
        const providers = [...new Set(priorityList)].filter(p => p);

        // 2. Loop through each one
        for (const provider of providers) {
            try {
                logger.info(`DefaultAdapter(audioRecorderBot): Attempting transcription with: ${provider.toUpperCase()}`);
                
                const formData = new FormData();
                formData.append('file', fs.createReadStream(filePath));

                let apiUrl, apiKey, modelName;

                // 3. Setup the specific provider details
                if (provider === 'openai') {
                    apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
                    apiKey = settings.ai.openaiApiKey;
                    modelName = 'whisper-1';
                } else if (provider === 'groq') {
                    apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
                    apiKey = settings.ai.groqApiKey;
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
                logger.info(`DefaultAdapter(audioRecorderBot): ${provider.toUpperCase()} Success!`);
                return response.data.text;

            } catch (error) {
                // 5. IMPORTANT: DO NOT THROW HERE
                // We just log the error and let the 'for' loop continue to the next provider
                const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
                logger.warn(`DefaultAdapter(audioRecorderBot): ${provider.toUpperCase()} failed: ${errorMsg}. Continuing to next provider...`);
            }
        }

        // 6. Only reach here if EVERY provider in the list failed
        logger.error("DefaultAdapter(audioRecorderBot): ALL transcription providers failed. Saving audio for manual retry.");
        return null; 
    }

    async diarizeAudio(filePath) {

        return new Promise((resolve, reject) => {

            exec(

                `python "${path.join(__dirname, '../diarize.py')}" "${filePath}"`,

                {
                    maxBuffer: 1024 * 1024 * 50
                },

                (error, stdout, stderr) => {

                    if (error) {

                        logger.error(
                            `Diarization failed: ${error.message}`
                        );

                        logger.error(stderr);

                        return reject(error);
                    }

                    try {

                        const cleanOutput =
                            stdout
                                .trim()
                                .split('\n')
                                .find(line =>
                                    line.startsWith('[')
                                );

                        const speakers =
                            JSON.parse(cleanOutput);

                        resolve(speakers);

                    } catch (err) {

                        logger.error(
                            `JSON parse failed: ${err.message}`
                        );

                        logger.error(stdout);

                        reject(err);
                    }
                }
            );
        });
    }

    async transcribeAudio(filePath) {
        if (!fs.existsSync(filePath)) {
            logger.error(`DefaultAdapter(audioRecorderBot): File not found for transcription: ${filePath}`);
            return null;
        }

        // 1. Define your backup order
        const priorityList = [settings.ai.provider, 'openai', 'groq'];
        const providers = [...new Set(priorityList)].filter(p => p);

        // 2. Loop through each one
        for (const provider of providers) {
            try {
                logger.info(`DefaultAdapter(audioRecorderBot): Attempting transcription with: ${provider.toUpperCase()}`);
                
                const formData = new FormData();
                formData.append('file', fs.createReadStream(filePath));

                let apiUrl, apiKey, modelName;

                // 3. Setup the specific provider details
                if (provider === 'openai') {
                    apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
                    apiKey = settings.ai.openaiApiKey;
                    modelName = 'whisper-1';
                } else if (provider === 'groq') {
                    apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
                    apiKey = settings.ai.groqApiKey;
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
                logger.info(`DefaultAdapter(audioRecorderBot): ${provider.toUpperCase()} Success!`);
                return response.data.text;

            } catch (error) {
                // 5. IMPORTANT: DO NOT THROW HERE
                // We just log the error and let the 'for' loop continue to the next provider
                const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
                logger.warn(`DefaultAdapter(audioRecorderBot): ${provider.toUpperCase()} failed: ${errorMsg}. Continuing to next provider...`);
            }
        }

        // 6. Only reach here if EVERY provider in the list failed
        logger.error("DefaultAdapter(audioRecorderBot): ALL transcription providers failed. Saving audio for manual retry.");
        return null; 
    }

    async generateSummary(audioText, labeledText) {

        // Safety check
        if (!audioText || audioText.trim().length < 5) {

            logger.warn(
                'DefaultAdapter(audioRecorderBot): Transcript too short for summary.'
                );

            return 'Transcript too short for summary.';
        }

        const provider = settings.ai.provider;

        try {

            logger.info(
                `DefaultAdapter(audioRecorderBot): Generating Summary with ${provider.toUpperCase()}`
                );

            let response;
            let finalText = '';

            // Shared prompt
            const systemPrompt = `
            You are a professional meeting summarizer.

            Rules:
            1. Create concise meeting summary
            2. List key discussion points
            3. List action items
            4. Mention speaker names if available
            5. Ignore separator/header/footer lines
            `;

            const userPrompt = `
            Audio Transcript:
            ${audioText}

            Labeled Captions:
            ${(labeledText || '').slice(0, 12000)}
            `;

            // =====================================================
            // OPENAI
            // =====================================================

            if (provider === 'openai') {

                response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: 'gpt-4o-mini',

                        messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userPrompt
                        }
                        ],

                        temperature: 0.3
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${settings.ai.openaiApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 60000
                    }
                    );

                finalText =
                response?.data?.choices?.[0]?.message?.content || '';
            }

            // =====================================================
            // GROQ
            // =====================================================

            else if (provider === 'groq') {

                response = await axios.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    {
                        model: 'llama3-8b-8192',

                        messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userPrompt
                        }
                        ],

                        temperature: 0.3
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${settings.ai.groqApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 60000
                    }
                    );

                finalText =
                response?.data?.choices?.[0]?.message?.content || '';
            }

            // =====================================================
            // GEMINI
            // =====================================================

            else if (provider === 'gemini') {

                response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/${settings.ai.geminiModel}:generateContent?key=${settings.ai.geminiApiKey}`,
                    {
                        contents: [
                        {
                            parts: [
                            {
                                text: `
                                ${systemPrompt}

                                ${userPrompt}
                                `
                            }
                            ]
                        }
                        ]
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        timeout: 60000
                    }
                    );

                finalText =
                response?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }

            // =====================================================
            // OLLAMA
            // =====================================================

            else if (provider === 'ollama') {

                response = await axios.post(
                    `${settings.ai.ollamaUrl}/chat/completions`,
                    {
                        model: settings.ai.ollamaModel,

                        messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userPrompt
                        }
                        ],

                        temperature: 0.3
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        timeout: 120000
                    }
                    );

                finalText =
                response?.data?.choices?.[0]?.message?.content || '';
            }

            // =====================================================
            // UNKNOWN PROVIDER
            // =====================================================

            else {

                throw new Error(
                    `Unsupported AI provider: ${provider}`
                    );
            }

            // =====================================================
            // SUCCESS
            // =====================================================

            if (!finalText) {

                throw new Error(
                    `Empty response from provider: ${provider}`
                    );
            }

            logger.info(
                `DefaultAdapter(audioRecorderBot): Summary generated successfully with ${provider.toUpperCase()}`
                );

            return finalText;

        } catch (error) {

            const errorMsg = error.response
            ? JSON.stringify(error.response.data)
            : error.message;

            logger.error(
                `Summary generation failed: ${errorMsg}`
                );

            return `Summary generation failed: ${errorMsg}`;
        }
    }


}

module.exports = ProfessionalMeetingBot;