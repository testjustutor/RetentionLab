# Zoom Transcript Bot - Production Ready 🚀

## Quick Start

### One-click / no-command start (recommended)

This project is a **Node.js app on its own port (3000)** — it is NOT a PHP project
that Apache serves directly from htdocs. To run it without ever typing a command:

1. **Double-click** `start-retentionlab.bat`
   - It finds its own folder automatically, so it works no matter where you place it.
   - It starts the server and opens your browser to `http://localhost:3000/`.
   - A black console window stays open while the server runs; close it to stop.

2. **Optional: auto-start with Windows** (so it's always running in the background):
   - Double-click `install-retentionlab-autostart.bat` once.
   - From then on the server starts silently at every Windows logon.
   - To undo: double-click `remove-retentionlab-autostart.bat`.

> Requires MySQL/MariaDB to be running (the XAMPP Control Panel "MySQL" service),
> and the `retention_lab` database to exist (run `npm run db:init` once if needed).

### Why `http://localhost/RetentionLab` is not a drop-in (important)

PHP projects work in XAMPP because the already-running Apache interprets `.php`
files directly. This app is **Node.js/Express on its own port 3000**, so it cannot
be "served from the htdocs folder" the way PHP is. Two things would both have to be
true to get a folder-name URL like `http://localhost/RetentionLab`:

1. The Node server must be running (see the one-click/auto-start above).
2. Apache would need to **reverse-proxy** `/RetentionLab/...` to `localhost:3000`.

The catch: this app hardcodes absolute URLs everywhere (`fetch('/api/...')`,
redirects to `/login`, `/dashboard`, `/css/...`) and uses Socket.io. A subfolder
proxy therefore does **not** "just work" — every absolute URL/the WebSocket would
point at the server root and break unless the whole front-end/controllers are
rewritten to use a base path. That is a large, risky change on an 800+ file app
and has not been applied.

The reliable, portable answer is the one-click / auto-start launcher above, which
starts the same live server and opens `http://localhost:3000/`. If you specifically
need `http://localhost/RetentionLab`, tell us and we can plan the base-path
refactor as a separate, carefully-tested task.

### Optional: serve it at your own local URL (e.g. www.localretentionlab.com) through XAMPP Apache

If you want to open the app at a friendly local hostname (like `www.your-domain.com`)
via your XAMPP Apache instead of `localhost:3000`, use the portable helper:

1. **Double-click `setup-live-url.bat`** (run as Administrator — it will ask).
2. Type the URL/domain you want to use on **this** machine (e.g. `localretentionlab.com`,
   `myapp.test`, …) and press Enter.
3. The script auto-detects the project folder (no matter its name or location) and:
   - enables Apache `mod_proxy_http` + `mod_proxy_wstunnel` (WebSocket),
   - writes/refreshes a reverse-proxy **v-host** in
     `C:\xampp\apache\conf\extra\httpd-vhosts.conf` using this folder as the root
     and the domain you entered (Socket.IO included),
   - adds `domain + www.domain -> 127.0.0.1` to the Windows `hosts` file,
   - starts the Node backend (from the `PORT` in `.env`),
   - opens the browser.
4. **You manually** start/restart Apache in the XAMPP Control Panel, then open
   the URL you chose.

**Portable:** because the v-host is generated from the script's own folder, you
can copy the whole project onto **another machine's XAMPP**, re-run
`setup-live-url.bat`, give it a different domain, restart Apache, and it works —
no manual Apache file editing needed. (Requirement is the same as always: MySQL on,
DB exists, Node + the project's `node_modules` installed on that machine.)

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
npm run structure:update # Refresh project_structure_only.txt
```

### Refresh the project structure

Run this from the project root in PowerShell whenever files or folders change:

```powershell
.\generate_structure.ps1
```

The command updates `project_structure_only.txt` and excludes generated folders such as `.git`, `.venv`, `.vscode`, `node_modules`, and Python cache directories.

## Features

✅ **Auto-join** any Zoom meeting (link/ID/passcode)
✅ **Live captions** with speaker names
✅ **MySQL storage** (retention_lab database)
✅ **JSON/TXT export** (storage/)
✅ **Participant detection** (live logs)
✅ **Auto-shutdown** when meeting ends
✅ **Mute bot** (no audio/video)
✅ **Full debug logs** (logs/combined.log)

## Structure

```
database/     → MySQL setup (database/db.js, database/python_db.py)
models/       → DB models
services/     → Bot logic (join, captions, monitor)
utils/        → Logger, export
storage/      → JSON/TXT exports
logs/         → Debug logs
```

For the complete application architecture, data flow, AI pipeline, development process, and AI coding guidelines, read [ARCHITECTURE.md](ARCHITECTURE.md).

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
    npm install -g pm2  


## To install Seeder data

    npm run db:init
    npm run db:migrate
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

# To test node file code is correct
    node --check services\platforms\google-meet\monitor.js

## To test dummy audio file
    # Prefer this: pass a meeting_sessions.id and it auto-resolves meeting_id + audio file from the DB
    node test-engine.js 8

    # Fallback: full recording path (meetingId/sessionId parsed from the filename)
    node test-engine.js .\storage\recordings\REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3

    # Fallback: explicit ids after the path (uses caller_supplied context)
    node test-engine.js .\storage\recordings\REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3 12 23


## To run AI tutor session evaluation from a session id
    # Pass a meeting_sessions.id — it auto-resolves meeting_id + transcript from the DB
    .\.venv\Scripts\python.exe test_ai_evaluation.py 9

    # (Fallback if not using the venv:)
    python test_ai_evaluation.py 9


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

Step 8 :    pip install openai-whisper
            pip install openai
            pip install sentence-transformers
            pip install -U google-genai
            pip install deepgram-sdk

Step 8 : Copy paste .dll file from ffmppeg (8.1.1-full_build-shared) to C://ffmpeg/bin/


Step 10 : npm start

            For Account Join & Manual meeting launch -> schedule-intelligence.html
            For database -> data-architecture.html
            For old Meetings -> archives.html
            For Storage -> assets.html
            For Logs -> audit.html
            For Bot Tracking -> bot.html
