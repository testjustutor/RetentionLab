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
    userDataDir: process.env.CHROME_PROFILE_PATH,

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

  // Named audio-DEVICE selection for the Teams bot's own Speaker/Microphone
  // pickers on the pre-join/lobby screens (services/platforms/teams/
  // teamsJoiner.js's selectAudioDevices()) — distinct from muteMicOnJoin/
  // disableCameraOnJoin in featureConfig.js, which only toggle mic/camera
  // ON/OFF and never change which device is selected. Left on the
  // machine's default, Teams can pick real hardware (e.g. a physical
  // headset), risking feedback/echo in the meeting, so these point it at
  // the VB-Audio Virtual Cable pair instead:
  //   speakerDeviceName -> Teams plays meeting audio INTO this device
  //     (default "CABLE Input (VB-Audio Virtual Cable)")
  //   micDeviceName -> Teams captures the bot's mic FROM this device
  //     (default "CABLE Output (VB-Audio Virtual Cable)")
  // speakerDeviceName deliberately matches the OTHER end of the same cable
  // pair that audio.deviceName above already records FROM — this is what
  // puts the meeting's own audio onto that cable in the first place.
  // Override per-machine via TEAMS_SPEAKER_DEVICE_NAME / TEAMS_MIC_DEVICE_NAME
  // in .env; set either to an empty string to skip selecting that device
  // and leave Teams' default in place. This does NOT affect the shared
  // `puppeteer` launch config above — it's read only by teamsJoiner.js's
  // page-level device-selection helper.
  teamsAudio: {
    speakerDeviceName:
      process.env.TEAMS_SPEAKER_DEVICE_NAME !== undefined
        ? process.env.TEAMS_SPEAKER_DEVICE_NAME
        : 'CABLE Input (VB-Audio Virtual Cable)',
    micDeviceName:
      process.env.TEAMS_MIC_DEVICE_NAME !== undefined
        ? process.env.TEAMS_MIC_DEVICE_NAME
        : 'CABLE Output (VB-Audio Virtual Cable)',
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
      baseUrl: process.env.TEAMS_BASE || "https://teams.microsoft.com/l/meetup-join",
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
    provider: process.env.AI_PROVIDER, 
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL, 
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL, 
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL , 
    ollamaUrl: process.env.OLLAMA_URL,
    ollamaModel: process.env.OLLAMA_MODEL
  },

  pipeline_features: {
    media_extraction: true,
    transcription: true,
    ai_audit: true,
    tutor_eval: true,
    summary_generation: true,
    persist_results: true
  },

  services: {
    audioRecorder: true,
    chatCapture: true,
    captionCapture: true,
    transcription: true,
    summarizer: true
  },

  // NEW: bot join-gating config (see socraticbot.js waitForHumanParticipant()).
  // How long the bot waits, AFTER it has already been admitted into the
  // meeting, for a real human participant to actually show up in the
  // roster before giving up, closing the browser, and marking the meeting
  // 'missed' instead of starting recording/Python processing.
  //
  // This is a SEPARATE stage/timeout from hostWaitTimeoutMs below (that one
  // covers the lobby/waiting-room wait, BEFORE the bot is even let in).
  // If HUMAN_JOIN_TIMEOUT_MS isn't set explicitly, this falls back to the
  // same value as BOT_HOST_WAIT_TIMEOUT_MS (so configuring just that one
  // .env var, as most people do, also extends this stage) rather than a
  // hardcoded 60s — a bare 60-second window was routinely too short for
  // real participants to actually join after the bot did, causing bots to
  // give up and close even though people did show up a bit later.
  bot: {
    humanJoinTimeoutMs: parseInt(
      process.env.HUMAN_JOIN_TIMEOUT_MS || process.env.BOT_HOST_WAIT_TIMEOUT_MS || '60000',
      10
    ),

    // How long the bot waits for the host to allow/admit it into the meeting
    // (lobby / waiting room) before giving up. This is the single knob that
    // drives ALL platform joiners (zoom / google-meet / teams) — see
    // BOT_HOST_WAIT_TIMEOUT_MS in .env / .env.example.
    // Default 900000 ms = 15 minutes.
    hostWaitTimeoutMs: parseInt(process.env.BOT_HOST_WAIT_TIMEOUT_MS || '900000', 10),

    // How many minutes BEFORE the meeting start time the bot auto-launches /
    // auto-joins. Single knob for the queued-meeting launch window and the
    // "Bot will join meeting within MM:SS" countdown on Admin > Meetings >
    // Live. See BOT_LAUNCH_LEAD_MINUTES in .env / .env.example.
    // Default 3 minutes (launch window = 1-3 minutes before start).
    autoJoinLeadMinutes: Math.max(1, parseInt(process.env.BOT_LAUNCH_LEAD_MINUTES || '3', 10)),

    // How long (minutes) past a QUEUED meeting's scheduled_start_time
    // BotPollingController.pollQueuedMeetings() will keep retrying before
    // giving up and marking it 'expired' instead of launching a bot. See
    // BOT_QUEUED_EXPIRE_MINUTES in .env / .env.example. Default 5.
    queuedExpireMinutes: parseInt(process.env.BOT_QUEUED_EXPIRE_MINUTES || '5', 10)
  }
};
