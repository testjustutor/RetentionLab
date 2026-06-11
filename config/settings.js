/**
 * root/config/settings.js
 */
require('dotenv').config();
const puppeteer = require('puppeteer');

function getActivePlatform() {
  const envPlatform =
    process.env.PLATFORM ||
    process.env.BOT_PLATFORM ||
    process.env.MEETING_PLATFORM ||
    process.env.npm_config_platform;

  if (envPlatform) {
    return envPlatform;
  }

  try {
    const botManager = require('../services/shared/botManager');

    for (const instance of botManager.instances?.values?.() || []) {
      const platform = instance?.bot?.platform || instance?.config?.platform;
      if (platform) {
        return platform;
      }
    }
  } catch {}

  return null;
}

function isGoogleMeetPlatform() {
  const platform = String(getActivePlatform() || '').toLowerCase();
  return platform === 'google-meet' || platform === 'google meet';
}

module.exports = {
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,

    // 🔥 dynamic mode switch
    get headless() {
      return isGoogleMeetPlatform() ? false : false;
    },

    defaultViewport: null,
    protocolTimeout: 180000,
    slowMo: 0,
    ignoreDefaultArgs: ['--mute-audio'],
    // 🔥 IMPORTANT: isolate profile per mode
    get userDataDir() {
      return isGoogleMeetPlatform()
        ? process.env.CHROME_PROFILE_PATH || "./chrome-profiles"
        : "./storage/chrome-profiles";
    },
    // userDataDir: null,

    get args() {
      return [
        "--start-maximized",
        
        // ── Media permissions ────────────────────────
        '--use-fake-ui-for-media-stream',           // auto-accept mic/camera

        "--disable-notifications",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-permissions-api",
        "--disable-features=TranslateUI",

        // "--mute-audio",

        '--disable-features=ExternalProtocolDialog',
        '--no-default-browser-check',
        '--disable-popup-blocking',

        '--auto-select-desktop-capture-source=Tab', // ✅ ADD: needed for tab audio capture

        // ── Audio Quality ─────────────────────────────
        '--audio-output-sample-rate=48000',           // ✅ KEEP: full quality
        '--audio-buffer-size=4096',                   // ✅ KEEP: fewer dropouts

        
        // ── WebRTC ────────────────────────────────────
        '--enable-features=WebRtcAudioProcessing',    // ✅ KEEP
        '--disable-features=WebRtcHideLocalSimulcastSignalingTarget',
        '--disable-webrtc-hw-encoding',               // ✅ ADD: software encoding = more stable
        '--disable-webrtc-hw-decoding',               // ✅ ADD: software decoding = clearer audio

        // ── AudioContext / Autoplay ───────────────────
        '--autoplay-policy=no-user-gesture-required', // ✅ KEEP: prevents ctx suspension

        "--protocol-handler-policy=block-external-protocol-dialogs",

      // 🔥 only for headful stability
        ...(isGoogleMeetPlatform()
          ? ["--disable-blink-features=AutomationControlled"]
          : [
              "--disable-blink-features=AutomationControlled",
              "--disable-dev-shm-usage",
              "--window-size=1920,1080",
              "--force-webrtc-ip-handling-policy=default_public_interface_only"
            ])
      ];
    }
  },

  audio: {
    deviceName: "audio=CABLE Output (VB-Audio Virtual Cable)",
    bitrate: "128k",
    sampleRate: "16000",
    channels: "1",
    format: "libmp3lame",
    
    // Applied during webm → wav conversion in audioRecorderBot
    enhancementFilters: [
      'highpass=f=80',              // cut keyboard/desk rumble below 80Hz
      'afftdn=nf=-25',              // FFT noise reduction
      'loudnorm=I=-16:TP=-1.5:LRA=11', // normalize to -16 LUFS (broadcast standard)
      'aresample=16000',            // resample last (after processing)
    ],
  },

  screen: {
    framerate: '15',      // 15fps is plenty for meeting recordings, saves disk space
    crf: '28',            // compression quality — 18–28 is good range
  },

  paths: {
    recordings: "storage/recordings",
    transcripts: "storage/transcripts",
    logs: "logs"
  },

  platforms: {
    zoom: {
      baseUrl: process.env.ZOOM_MEETING_LINK,
      botName: process.env.BOT_NAME,
      requiresPasscode: true,
      joinStrategy: "webclient",
      autoEnableCaptions: true
    },

    "google-meet": {
      baseUrl: process.env.GOOGLE_MEET_BASE || "https://meet.google.com/",
      botName: process.env.BOT_NAME,
      joinStrategy: "direct-link",
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

  HF_TOKEN: process.env.HF_TOKEN,

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

  pipeline_features: {
    media_extraction: true,
    transcription: true,
    intel_extraction: true,
    ai_audit: true,
    summary_generation: true,
    topic_clustering: true
  },

  services: {
    audioRecorder: true,
    chatCapture: true,
    captionCapture: true,
    transcription: true,
    summarizer: true
  }
};
