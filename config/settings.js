require('dotenv').config();
const puppeteer = require('puppeteer');

module.exports = {
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: false, // "new" or false - using false for compatibility with Google Meet UI detection
    defaultViewport: null,
    protocolTimeout: 60000,
    userDataDir: process.env.CHROME_PROFILE_PATH || "./chrome-profile",
    args: [
      "--start-maximized",
      "--use-fake-ui-for-media-stream",
      "--disable-notifications",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ]
  },

  audio: {
    // 🟢 The exact name from your 'ffmpeg -list_devices' command
    deviceName: "audio=CABLE Output (VB-Audio Virtual Cable)", // Virtual Cable Software
    // deviceName: "audio=Headset Microphone (Sennheiser SC60 for Lync)",  // when connected headphone 
    bitrate: "128k",
    sampleRate: "44100",
    channels: "2",
    format: "libmp3lame"
  },

  paths: {
    recordings: "storage/recordings",
    transcripts: "storage/transcripts",
    logs: "logs"
  },

  platforms: {
    zoom: {
      baseUrl: process.env.ZOOM_MEETING_LINK, // required
      botName: process.env.BOT_NAME,
      requiresPasscode: true,
      joinStrategy: "webclient", // important
      autoEnableCaptions: true
    },

    "google-meet": {
      baseUrl: process.env.GOOGLE_MEET_BASE || "https://meet.google.com/",
      botName: process.env.BOT_NAME,
      joinStrategy: "direct-link", // use event link directly
      autoJoin: true,
      autoEnableCaptions: true
    },

    teams: {
      baseUrl: process.env.TEAMS_BASE || "https://teams.live.com/meet/",
      botName: process.env.BOT_NAME,
      joinStrategy: "direct-link",
      autoJoin: true,
      autoEnableCaptions: true
    }
  },

  google: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
  },

  webhookUrl: process.env.WEBHOOK_URL,

  ai: {
    provider: "groq",
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: "gemini-2.0-flash",
    openaiApiKey: process.env.OPENAI_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
    xaiApiKey: process.env.XAI_API_KEY,
    ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434/v1",
    ollamaModel: process.env.OLLAMA_MODEL || "llama3.1"
  },

  services: {
    audioRecorder: true,
    chatCapture: true,
    captionCapture: true,
    transcription: true,
    summarizer: true
  }
};