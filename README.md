# Zoom Transcript Bot - Production Ready 🚀

## Quick Start

### Option 1: Single Meeting (CLI)
```bash
1. cp .env.example .env
2. Edit .env with your Zoom meeting details
3. npm start                    # Runs node index.js
```

### Option 2: Multiple Meetings (Dashboard UI)
```bash
1. npm run dashboard           # Starts dashboard server on http://localhost:3001
2. Open http://localhost:3001/dashboard.html
3. Enter meeting details and click "Launch Bot"
4. Monitor real-time bot status and logs from dashboard
```

## Available Commands

```bash
npm start                 # Run single meeting bot (uses .env)
npm run dev              # Run with nodemon auto-reload
npm run dashboard        # Start dashboard UI server (port 3001)
npm run dev:dashboard    # Dashboard with auto-reload
npm run db:init          # Initialize/reset database
```

## Features

✅ **Auto-join** any Zoom meeting (link/ID/passcode)
✅ **Live captions** with speaker names
✅ **SQLite storage** (transcripts.db)
✅ **JSON/TXT export** (storage/)
✅ **Participant detection** (live logs)
✅ **Auto-shutdown** when meeting ends
✅ **Mute bot** (no audio/video)
✅ **Full debug logs** (logs/combined.log)

## Structure

```
database/     → SQLite setup
models/       → DB models
services/     → Bot logic (join, captions, monitor)
utils/        → Logger, export
storage/      → JSON/TXT exports
logs/         → Debug logs
```

## Dashboard Features

The **ZoomBot.ai Dashboard** provides a UI to manage multiple bot instances:

- **Launch Bot** - Start new meeting transcription with meeting ID & passcode
- **Live Status** - Monitor all active bots in real-time
- **Storage Stats** - View transcript storage usage
- **Logs** - Stream and filter logs by meeting
- **Stop Bot** - Gracefully shutdown any running bot

**Run dashboard:**
```bash
npm run dashboard          # Production
npm run dev:dashboard     # Development with auto-reload
```

Open: `http://localhost:3001/dashboard.html`

## API Reference

### Bot Management
```
POST   /bot/start-bot                    # Start new bot
GET    /bot/list                         # List active bots
GET    /bot/status/:meetingId            # Get bot status
DELETE /bot/stop-bot/:meetingId          # Stop bot
```

### Storage & Logs
```
GET    /storage/stats                    # Storage usage stats
GET    /logs                             # List log files
GET    /logs/:filename                   # Read specific log
```

All APIs require running `npm run dashboard`

## Debug

```
tail -f logs/combined.log | grep "👥\|🔍\|✅"
```

**Live Output:**
```
[10:05:23] John Doe: Let's start
[10:05:30] Sarah: Agreed
👥 LIVE PARTICIPANTS: John, Sarah, Bot
```

## Troubleshooting

**No captions:** Enable "Live Transcript" in Zoom
**Bad names:** Check logs/participants selectors  
**Export empty:** Captions off OR meeting ended early

**Production:** `npm start` / PM2 / Docker ready

🎉 Ready for any meeting!

## To install npm 

    npm install -g npm


## To install Seeder data

    npm run db:init
    npm run db:seed

## Mail setup for calendar verification

To send calendar verification emails, add SMTP values to `.env`.

### Gmail / Google Workspace
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourname@gmail.com
SMTP_PASS=your_google_app_password
MAIL_FROM="Retention Lab <yourname@gmail.com>"
```

### Outlook / Microsoft 365
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourname@outlook.com
SMTP_PASS=your_mailbox_password_or_app_password
MAIL_FROM="Retention Lab <yourname@outlook.com>"
```

### Custom domain mail
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
MAIL_FROM="Retention Lab <no-reply@yourdomain.com>"
```

If you use port `465`, set `SMTP_SECURE=true`.

## To vertal environment of pythone new

    deactivate
    Remove-Item -Recurse -Force .venv
    python -m venv .venv
    .venv\Scripts\activate
    python -m pip install --upgrade pip

## To test is my python engine code correct

    python -c "import services.engine.engine_main as m; print('import_ok')"
    python -c "import importlib; importlib.import_module('services.engine.engine_main'); print('import_ok')"

## To test pyannote
    python -c "from pyannote.audio import Pipeline; Pipeline.from_pretrained('pyannote/speaker-diarization', token=True)"

# To test node file code is correct
    node --check services\platforms\google-meet\monitor.js

## To test dummy audio file
    del .test-engine.lock
    Remove-Item .test-engine.lock -Force
    node test-engine.js .\storage\recordings\REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3


## FFMPEG
ffmpeg -hide_banner -devices



Step 1 : git clone https://github.com/testjustutor/RetentionLab.git

Step 2 : git checkout development (temporary for development)

Step 3 : npm install
            npm install mysql2 dotenv

Step 4 :   if already have old .venv 
            deactivate
            Remove-Item -Recurse -Force .venv

Step 5 :    & "C:\Users\shyam.charan\AppData\Local\Programs\Python\Python310\python.exe" -m venv .venv

Step 6 : .\.venv\Scripts\Activate.ps1

Step 7 : python -m pip install --upgrade pip

Step 8 :    pip install pyannote.audio
            pip install openai-whisper
            pip install openai
            pip install sentence-transformers

Step 8 : Copy paste .dll file from ffmppeg (8.1.1-full_build-shared) to C://ffmpeg/bin/


Step 10 : npm start

            For Account Join & Manual meeting launch -> schedule-intelligence.html
            For database -> data-architecture.html
            For old Meetings -> archives.html
            For Storage -> assets.html
            For Logs -> audit.html
            For Bot Tracking -> bot.html
