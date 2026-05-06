# 🚀 COMPLETE STEP-BY-STEP EXECUTION FLOW: server.js → Transcript Storage (Every File & Function)

**Granular Trace** - Every require, function call, data carried, DB write, file write.

## 🎯 **PHASE 1: Server Startup (server.js - Lines 1-300)**

### 1.1 **File**: `server.js`
```
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
```
- **Data**: Loads .env → PORT=3000

```
const TranscriptModel = require('./models/transcriptModel');
const { logger } = require('./utils/logger');
const { initDB } = require('./database/db');
const botManager = require('./services/botManager');
const MeetingModel = require('./models/MeetingModel');
const CalendarUsersModel = require('./models/CalendarUsersModel');
const MultiUserCalendarService = require('./services/calendar/MultiUserCalendarService');
```
- **Files Loaded**: models/transcriptModel.js, utils/logger.js, database/db.js, services/botManager.js, models/MeetingModel.js, models/CalendarUsersModel.js, services/calendar/MultiUserCalendarService.js

```
app.use('/api/bot', require('./routes/bot'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/db', require('./routes/db-admin'));
```
- **Routes**: routes/bot.js, routes/calendar.js, routes/meetings.js, routes/db-admin.js

```
CalendarUsersModel.createTable() → initDB()
```
- **DB**: transcripts.db created, users table ensured

### 1.2 **File**: `database/db.js`
```
const dbPath = path.resolve(__dirname, '..', 'transcripts.db');
const db = new sqlite3.Database(dbPath);
db.run(`CREATE TABLE IF NOT EXISTS transcripts (...)`);
db.run(`CREATE TABLE IF NOT EXISTS meeting_sessions (...)`);
```
- **Writes**: transcripts.db schema (transcripts, meeting_sessions tables)

### 1.3 **Function**: `backgroundSyncAllUsers()` (server.js)
```
users = await CalendarUsersModel.getAllUsers();
for user in users:
  service = new MultiUserCalendarService()
  service.initialize(user.email)
  events = service.getEvents({timeMin, timeMax})
  for e in events:
    link = extractMeetingLink(e.description)
    platform = detectPlatform(link)
    {meetingId, passcode} = extractMeetingId(link, platform, e.description)
    MeetingModel.getMeetingByIdOrCreate({
      meetingId, platform, passcode, eventId: e.id, account: user.email,
      meetingLink: link, startTime: e.start.dateTime, ...
    })
```
- **Files**: services/calendar/MultiUserCalendarService.js → Google API calls
- **Data Carried**: meeting objects to MeetingModel
- **Interval**: Runs every 30min + on startup

## 🎯 **PHASE 2: Polling & Bot Launch (Every 10s)**

### 2.1 **server.js Polling Interval**
```
setInterval(async () => {
  queued = await MeetingModel.getQueuedMeetings();
  for meeting in queued:
    if new Date(meeting.start_time) <= now:
      botManager.launchFromDb(meeting)
}, 10000)
```

### 2.2 **File**: `services/botManager.js`
```
async launchFromDb(meeting):
  session = await TranscriptModel.createSession(meeting.meetingId)
  // Launches platform adapter based on meeting.platform
```
- **Data**: `{meetingId, sessionId}`
- **Writes**: meeting_sessions INSERT (id, meeting_id)

### 2.3 **Platform Launch Chain**
```
botManager → services/platforms_old/platformFactory.js → 
ZoomAdapter.js | GoogleMeetAdapter.js | TeamsAdapter.js
```
- **Functions**: `monitorTranscript()` in adapters → starts caption polling

## 🎯 **PHASE 3: Caption Capture → Transcript Save (Core Loop)**

### 3.1 **File**: `services/captionMonitor.js` (Zoom Primary)
```
class CaptionMonitor {
  constructor(meetingId, sessionId):
    timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    fileName = `transcript_${meetingId}_${sessionId}_${timestamp}.txt`
    filePath = storage/transcript/${fileName}
    fs.writeFileSync(filePath, header)
    TranscriptModel.saveTranscriptFile(sessionId, fileName)
  
  async processAndSaveTranscript(data):
    for item in data:  # from Puppeteer .lt-full-transcript__item
      speaker = item.name.replace(/:$/, '').trim()
      text = item.text.trim()
      TranscriptModel.createTranscript(sessionId, speaker, text, timestamp)
```
- **DOM Selectors**: `.lt-full-transcript__display-name`, `.lt-full-transcript__message`
- **Writes**:
  1. `storage/transcript/*.txt` (live append)
  2. `TranscriptModel.createTranscript()` → transcripts INSERT

### 3.2 **File**: `models/transcriptModel.js`
```
static createTranscript(sessionId, speaker, text, timestamp):
  stmt = db.prepare('INSERT INTO transcripts (meeting_session_id, speaker, text, timestamp) VALUES (?, ?, ?, ?)')
  stmt.run(sessionId, speaker || 'Unknown', text.trim(), timestamp)

static saveTranscriptFile(sessionId, fileName):
  db.run('UPDATE meeting_sessions SET transcript_file_name = ? WHERE id = ?', [fileName, sessionId])
```
- **DB Writes**: transcripts row + meeting_sessions.transcript_file_name

### 3.3 **Other Caption Sources**
| Service | Selector/Event | Save Function |
|---------|----------------|---------------|
| captionListener.js | `.zm-transcript-viewer` eval | TranscriptModel |
| meetJoiner.js | `[jsname="tgaKEf"]` interval | transcriptBuffer[] → save |
| monitor.js | on meeting end | exportMeetingTranscript() → utils/export.js |
| socraticbot.js | CaptionMonitor.startPolling() | delegates to captionMonitor |

## 🎯 **PHASE 4: Live Serving & Export**

### 4.1 **dashboard-server.js** (Port 3001)
```
findTranscriptFile(meetingId):
  TranscriptModel.getTranscriptFilePathByMeeting(meetingId) → filePath
  fs.watchFile(filePath) → Socket.IO 'transcriptUpdate' {content, fileName}
```
- **Live**: Watches storage/transcript/*.txt every 1s

### 4.2 **utils/export.js**
```
exportBoth(meetingId):
  transcripts = TranscriptModel.getTranscriptsByMeeting(meetingId)
  fs.writeFile(`storage/transcript-${meetingId}.json`, data)
  fs.writeFile(`storage/transcript-${meetingId}.txt`, formatted)
```
- **Data**: `{transcripts[], participants[], summary: '${count} utterances'}`

### 4.3 **API Access (server.js)**
```
app.get('/api/transcripts/:meetingId'):
  TranscriptModel.getTranscriptsByMeeting(req.params.meetingId)
```
- **SQL**: `SELECT t.*, s.meeting_id FROM transcripts t JOIN meeting_sessions s ON ... WHERE s.meeting_id = ?`

## 📊 **Complete File Dependency Chain**
```
server.js
├── database/db.js (transcripts.db)
├── models/transcriptModel.js (CRUD)
├── models/MeetingModel.js
├── models/CalendarUsersModel.js
├── utils/logger.js
├── services/botManager.js → launchFromDb()
├── services/calendar/MultiUserCalendarService.js → getEvents()
├── routes/bot.js, calendar.js, meetings.js, db-admin.js
├── services/captionMonitor.js → processAndSaveTranscript() → storage/*.txt
├── services/captionListener.js, monitor.js, meetJoiner.js
├── services/platforms_old/*Adapter.js
├── dashboard-server.js → live serve
└── utils/export.js → JSON/TXT export
```

## 🗄️ **DB Schema Flow**
```
meeting_sessions {id, meeting_id, transcript_file_name, start_time}
↑ saved by MeetingModel.getMeetingByIdOrCreate()
transcripts {id, meeting_session_id, speaker, text, timestamp}
↑ INSERT by TranscriptModel.createTranscript()
```

**Total Files Involved**: 18+ | **Auto Flow Time**: Startup → 10s poll → join → captions live.

**Test**: `node server.js` → watch logs → storage/transcript/ fills during Zoom meeting.


