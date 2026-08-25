/**
 * controllers/super_admin/settings/videoProcessingController.js
 * BUSINESS LOGIC for the Video Processing page.
 *
 * All DB access is delegated to VideoProcessingModel (queries only). This
 * controller owns orchestration: filename parsing, filesystem/ffmpeg work, the
 * Python audio pipeline, seeding of users/meetings/sessions/calendar and the
 * `video_processing` identification rows (storing BOTH file-origin ids and the
 * real DB ids).
 */
const VideoProcessingModel = require('../../../models/super_admin/settings/VideoProcessingModel');
const { runPythonEngine, convertVideoToMp3 } = require('../../../services/python_engine/runner');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const RECORDINGS_DIR = path.join(ROOT_DIR, 'storage', 'screen-recordings');
const CONVERTED_DIR = path.join(ROOT_DIR, 'storage', 'recordings');
const DIARIZATION_DIR = path.join(ROOT_DIR, 'storage', 'video_diarization');

const SAFE_NAME_RE = /^[A-Za-z0-9_.\-\s]+\.mp4$/i;

// ------------------------------------------------------------------
// Filename + formatting helpers (pure logic)
// ------------------------------------------------------------------
function safeVideoName(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;
  // Accept either a bare filename or a full path/link (e.g.
  // '/storage/screen-recordings/<file>.mp4') — always validate the basename.
  const base = path.basename(rawName);
  // Reject separators/traversal: basename must not contain a path separator
  // and must match the safe .mp4 pattern.
  if (!SAFE_NAME_RE.test(base)) return null;
  return base;
}

function parseNamedVideoName(fileName) {
  const base = path.basename(String(fileName)).replace(/\.mp4$/i, '').trim();
  if (!base) return null;

  // First anchor: leading id + name/external/session until the date segment.
  // Two supported formats:
  //   Format 1 (legacy): <id>_<first>_<last>_<ext>_<sess>_<title>_YYYY_MM_DD[_HH-MM][_hash]
  //   Format 2 (current): <id>_<name>_<ext>_<sess>_<title>-YYYYMMDD_HHMMSS
  //
  // We parse by locating the session id (a digit-run that appears just before
  // the title) and the trailing date, which is more tolerant of names that
  // contain spaces.
  let instructorId = null;
  let firstName = null;
  let lastName = null;
  let externalMeetingId = null;
  let sessionId = null;
  let title = null;
  let dateStr = null;
  let timeStr = '09:00:00';
  let hash = '';

  // --- Candidate 1: legacy underscore-year format with date tokens + optional hash ---
  // Format: <id>_<...>_<title>_YYYY_MM_DD[_HH-MM-SS][_hash]
  let m = base.match(/^(\d+)_(.+?)_(\d{4})[-_](\d{2})[-_](\d{2})(?:[-_](\d{2})-(\d{2})-(\d{2}))?(?:_([a-f0-9]+))?$/i);
  if (m) {
    instructorId = Number(m[1]);
    const body = m[2]; // everything between id and the date
    const y = Number(m[3]), mm = Number(m[4]), d = Number(m[5]);
    if (!y || mm < 1 || mm > 12 || d < 1 || d > 31) return null;
    dateStr = `${m[3]}-${m[4]}-${m[5]}`;
    if (m[6]) timeStr = `${m[6]}:${m[7]}:${m[8]}`;
    hash = m[9] || '';
    const parts = body.split('_');
    // body = <first>_<last>_<ext>_<sess>_<title...>
    if (parts.length < 4) return null;
    firstName = parts[0];
    lastName = parts[1];
    externalMeetingId = parts[2];
    const sessRaw = parts[3];
    if (!/^\d+$/.test(sessRaw)) return null;
    sessionId = Number(sessRaw);
    title = parts.slice(4).join(' ').trim();
  } else {
    // --- Candidate 2: current format with compact date + space names ---
    // Format: <id>_<name>_<ext>_<sess>_<title>-YYYYMMDD_HHMMSS
    m = base.match(/^(\d+)_(.+?)_([^_]+)_(\d+)_(.+?)-(\d{8})[-_](\d{6})$/i);
    if (m) {
      instructorId = Number(m[1]);
      const fullName = m[2].replace(/_/g, ' ').trim();
      externalMeetingId = m[3];
      sessionId = Number(m[4]);
      title = m[5].replace(/_/g, ' ').trim();
      const ds = String(m[6]);
      dateStr = `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`;
      const ts = String(m[7]);
      timeStr = `${ts.slice(0, 2)}:${ts.slice(2, 4)}:${ts.slice(4, 6)}`;
      // name may be "First Last" or "First_Last" -> split on space only if present
      const nameParts = fullName.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
      // Accept session present
      if (!/^\d+$/.test(String(instructorId)) || !/^\d+$/.test(String(sessionId))) return null;
    } else {
      return null;
    }
  }

  if (!/^\d+$/.test(String(instructorId)) || !/^\d+$/.test(String(sessionId))) return null;
  return {
    instructorId, firstName, lastName, externalMeetingId, sessionId,
    title: (title || externalMeetingId),
    dateStr,
    timeStr,
    hash
  };
}

function scheduleTimes(parsed) {
  const timeStr = parsed.timeStr || '09:00:00';
  const start = `${parsed.dateStr} ${timeStr}`;
  const [h, mi, s] = timeStr.split(':').map(Number);
  const endH = (h + 1) % 24;
  const end = `${parsed.dateStr} ${String(endH).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return { start, end };
}

function toMp3Name(fileName) {
  const parsed = parseNamedVideoName(fileName);
  if (parsed) {
    const { start } = scheduleTimes(parsed);
    const [ymd, hms] = start.split(' ');
    const [Y, M, D] = ymd.split('-');
    const HM = hms.substring(0, 5).replace(':', '-');
    return `REC_${parsed.externalMeetingId}_Sess${parsed.sessionId}_${Y}_${M}_${D}_${HM}.mp3`;
  }
  return 'REC_' + path.basename(fileName).replace(/^SCREEN_/i, '').replace(/\.mp4$/i, '.mp3');
}

function videoLink(name) { return '/storage/screen-recordings/' + path.basename(name); }
function audioLink(mp3) { return '/storage/recordings/' + path.basename(mp3); }

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
function instructorEmail(firstName, lastName, instructorId) {
  const f = String(firstName || 'instructor').toLowerCase().replace(/[^a-z0-9]/g, '');
  const l = String(lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${f}.${l}.${instructorId}@example.com`;
}
function instructorPhone(instructorId) {
  return `+91${String(instructorId).padStart(10, '0').slice(-10)}`;
}
function meetingDescription(parsed) {
  return `${parsed.title} session recorded on ${parsed.dateStr.replace(/_/g, '-')} (dummy seed).`;
}
function teamsLink(parsed) {
  return `https://teams.microsoft.com/l/meetup-join/${parsed.dateStr.replace(/[^0-9]/g, '')}%40thread.v2`;
}
function randomEventId() { return 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12); }
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const secretKey = process.env.PASSWORD_SECRET_KEY || '';
  const derived = crypto.scryptSync(String(secretKey) + password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}
// ------------------------------------------------------------------
// Seeding orchestration (business logic; DB calls go to the model)
// ------------------------------------------------------------------

/** Resolve or create a meeting_sessions row; returns the REAL session id. */
async function resolveOrCreateSession(meetingId, start, end) {
  const existing = await VideoProcessingModel.findSessionByMeetingTime(meetingId, start, end).catch(() => null);
  if (existing && existing.id) return Number(existing.id);
  const insertId = await VideoProcessingModel.insertSession(meetingId, start, end).catch(() => null);
  if (!insertId) return null;
  const row = await VideoProcessingModel.getSessionById(insertId).catch(() => null);
  return row ? Number(row.id) : Number(insertId);
}

/** Ensure a calendar_connections 'teams' row exists for a user (dummy creds). */
async function ensureTeamsConnection(user) {
  try {
    const provider = await VideoProcessingModel.getProviderByName('teams');
    if (!provider) return;
    const conn = await VideoProcessingModel.findConnection(user.id, provider.id);
    if (!conn) {
      await VideoProcessingModel.insertConnection({
        userId: user.id, providerId: provider.id,
        accessToken: 'dummy_acc_' + Math.random().toString(36).substring(2, 20),
        refreshToken: 'dummy_ref_' + Math.random().toString(36).substring(2, 20)
      });
    }
  } catch (e) { /* non-fatal */ }
}

/** Resolve the instructor user for a named video:
 *  1) by the file's user id, 2) by the derived email, 3) by NAME (reuse an
 *  existing same-name user even if the file carries a different id). If none
 *  exists, create a new instructor. Returns { user, reused, created }.
 */
async function resolveNamedUser(parsed) {
  let user = await VideoProcessingModel.getUserById(parsed.instructorId).catch(() => null);
  if (!user) {
    user = await VideoProcessingModel.getUserByEmail(instructorEmail(parsed.firstName, parsed.lastName, parsed.instructorId)).catch(() => null);
  }
  if (user) return { user, reused: false, created: false };

  const byName = await VideoProcessingModel.getUserByName(parsed.firstName, parsed.lastName).catch(() => null);
  if (byName) return { user: byName, reused: true, created: false };

  const roleId = await VideoProcessingModel.getInstructorRoleId();
  if (!roleId) return { user: null, reused: false, created: false };
  const newId = await VideoProcessingModel.insertInstructor({
    userUuid: crypto.randomUUID(), roleId,
    firstName: parsed.firstName, lastName: parsed.lastName,
    email: instructorEmail(parsed.firstName, parsed.lastName, parsed.instructorId),
    passwordHash: hashPassword('password123'),
    phone: instructorPhone(parsed.instructorId)
  });
  return { user: { id: newId, first_name: parsed.firstName, last_name: parsed.lastName }, reused: false, created: true };
}

/** Seed a named video => returns real {user, meeting, session} + tracking info. */
async function seedNamedVideo(fileName) {
  const parsed = parseNamedVideoName(fileName);
  if (!parsed) return { success: false, error: 'Invalid named video filename format.' };

  const { user, reused } = await resolveNamedUser(parsed);
  if (!user) return { success: false, error: 'Instructor role not found in roles table.' };

  await ensureTeamsConnection(user.id);
  const { start, end } = scheduleTimes(parsed);
  const ui = user.id;

  let meeting = await VideoProcessingModel.findMeetingByExternalAndCreator(parsed.externalMeetingId, parsed.title, ui).catch(() => null);
  if (!meeting) {
    const mid = await VideoProcessingModel.insertMeeting({
      externalMeetingId: parsed.externalMeetingId, title: parsed.title,
      description: meetingDescription(parsed), start, end, platform: 'teams',
      calendarAccount: user.email, meetingLink: teamsLink(parsed), passcode: null,
      eventId: randomEventId(), timezone: 'Asia/Kolkata', status: 'sync', createdBy: ui
    });
    if (!mid) return { success: false, error: 'Failed to create meeting row.' };
    meeting = { id: mid };
  }

  const sessionId = await resolveOrCreateSession(meeting.id, start, end);
  if (!sessionId) return { success: false, error: 'Failed to create/lookup meeting session row.' };

  return {
    success: true,
    data: {
      meetingId: meeting.id, sessionId, instructorId: ui,
      externalMeetingId: parsed.externalMeetingId, title: parsed.title,
      firstName: parsed.firstName, lastName: parsed.lastName,
      fileUserId: parsed.instructorId, fileSessionId: parsed.sessionId, fileMeetingId: null
    }
  };
}
/**
 * Screen-recording seed: uses/reuses the default system-convert instructor,
 * upserts a meeting and resolves/creates a session. Returns tracking info.
 */
async function seedScreenVideo(fileName) {
  const m = /^SCREEN_([^_]+)_Sess(\d+)_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})\.mp4$/i.exec(fileName);
  if (!m) return { success: false, error: 'Invalid screen video filename format.' };
  const externalMeetingId = m[1];
  const fileSessionId = Number(m[2]);
  const start = `${m[3]}-${m[4]}-${m[5]} ${m[6]}:${m[7]}:00`;
  const d = new Date(`${m[3]}-${m[4]}-${m[5]}T${m[6]}:${m[7]}:00`);
  d.setHours(d.getHours() + 1);
  const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
  const title = 'Screen Recording ' + externalMeetingId;

  const user = await ensureDefaultInstructor();
  if (!user) return { success: false, error: 'Default system instructor could not be ensured.' };
  await ensureTeamsConnection(user.id);

  let meeting = await VideoProcessingModel.getMeetingByExternalId(externalMeetingId).catch(() => null);
  if (!meeting) {
    const mid = await VideoProcessingModel.insertMeeting({
      externalMeetingId, title, description: 'Screen recording imported from file',
      start, end, platform: 'teams', calendarAccount: user.email, meetingLink: null,
      passcode: null, eventId: randomEventId(), timezone: 'UTC', status: 'sync', createdBy: user.id
    });
    meeting = { id: mid };
  }

  const sessionId = await resolveOrCreateSession(meeting.id, start, end);
  return {
    success: true,
    data: {
      meetingId: meeting.id, sessionId, instructorId: user.id,
      externalMeetingId, title, fileUserId: null, fileSessionId, fileMeetingId: null,
      firstName: user.first_name || 'System', lastName: user.last_name || 'Converter'
    }
  };
}

async function ensureDefaultInstructor() {
  const email = 'system.convert@example.com';
  let user = await VideoProcessingModel.getUserByEmail(email).catch(() => null);
  if (user) return user;
  const roleId = await VideoProcessingModel.getInstructorRoleId();
  if (!roleId) return null;
  const newId = await VideoProcessingModel.insertInstructor({
    userUuid: crypto.randomUUID(), roleId, firstName: 'System', lastName: 'Converter',
    email, passwordHash: hashPassword('password123'), phone: null
  });
  return { id: newId, first_name: 'System', last_name: 'Converter', email };
}

/** Dispatch seed by filename type -> returns tracking ids. */
async function seedConvertVideo(fileName) {
  const parsed = parseNamedVideoName(fileName);
  if (parsed) {
    const seeded = await seedNamedVideo(fileName);
    if (!seeded.success) throw new Error(seeded.error || 'named-video seed failed');
    return {
      meetingId: seeded.data.meetingId, sessionId: seeded.data.sessionId,
      userId: seeded.data.instructorId, firstName: seeded.data.firstName,
      lastName: seeded.data.lastName, externalMeetingId: seeded.data.externalMeetingId,
      title: seeded.data.title, fileUserId: seeded.data.fileUserId,
      fileSessionId: seeded.data.fileSessionId, fileMeetingId: seeded.data.fileMeetingId
    };
  }
  const screen = await seedScreenVideo(fileName);
  if (!screen.success) return null;
  return {
    meetingId: screen.data.meetingId, sessionId: screen.data.sessionId,
    userId: screen.data.instructorId, firstName: screen.data.firstName,
    lastName: screen.data.lastName, externalMeetingId: screen.data.externalMeetingId,
    title: screen.data.title, fileUserId: screen.data.fileUserId,
    fileSessionId: screen.data.fileSessionId, fileMeetingId: screen.data.fileMeetingId
  };
}

/** Build the identification tracking record for video_processing.
 *  Keys match VideoProcessingModel.saveProcessingRecord exactly.
 *  Populates BOTH id families present in the table:
 *    - file-origin : file_user_id / file_meeting_id / file_session_id
 *                    (+ legacy video_user_id / video_meeting_id / video_session_id)
 *    - resolved DB : user_id / meeting_id / session_id
 *  *_type columns say which one the filename carried ('session' or 'meeting').
 */
function makeTrackRec({ fileName, status, mp3Path, seed }) {
  const fileUserId = seed?.fileUserId ?? seed?.userId ?? null;
  const fileSessionId = seed?.fileSessionId ?? null;
  const fileMeetingId = seed?.fileMeetingId ?? null;
  // The named-video formats carry a SESSION id in the filename; screen files too.
  const videoMeetingType = fileSessionId != null ? 'session' : (fileMeetingId != null ? 'meeting' : null);

  return {
    fileName,
    status,
    mp3Path: mp3Path ?? null,

    // file-origin ids (parsed from the video filename)
    fileUserId,
    fileMeetingId,
    fileSessionId,

    // real DB ids (users.id / meetings.id / meeting_sessions.id)
    userId: seed?.userId ?? null,
    meetingId: seed?.meetingId ?? null,
    sessionId: seed?.sessionId ?? null,

    // legacy duplicate columns kept in sync
    videoUserId: fileUserId,
    videoMeetingId: fileMeetingId,
    videoSessionId: fileSessionId,
    videoMeetingType,
    meetingType: videoMeetingType || 'teams',

    externalMeetingId: seed?.externalMeetingId ?? null,
    firstName: seed?.firstName ?? null,
    lastName: seed?.lastName ?? null,
    title: seed?.title ?? null
  };
}
// ------------------------------------------------------------------
// Controller methods (route handlers) — file helpers
// ------------------------------------------------------------------
async function getVideoFiles() {
  if (!fs.existsSync(RECORDINGS_DIR)) return [];
  return new Promise((resolve, reject) => {
    fs.readdir(RECORDINGS_DIR, (err, files) => {
      if (err) return reject(err);
      resolve((files || []).filter((f) => f.toLowerCase().endsWith('.mp4')).sort());
    });
  });
}

async function getFileMeta(fileName) {
  const filePath = path.join(RECORDINGS_DIR, fileName);
  if (!fs.existsSync(filePath)) return { size: '0.00', duration: '0:00', exists: false };
  const sizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
  return new Promise((resolve) => {
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, (error, stdout) => {
      if (error) return resolve({ size: sizeMB, duration: '0:00', exists: true });
      resolve({ size: sizeMB, duration: formatDuration(Number.parseFloat(stdout.trim())), exists: true });
    });
  });
}

async function resolveVideoIds(fileName, providedSessionId = null) {
  const parsed = parseNamedVideoName(fileName);
  if (parsed) {
    const meeting = await VideoProcessingModel.getMeetingByExternalId(parsed.externalMeetingId).catch(() => null);
    if (!meeting) return { meetingId: null, sessionId: null };
    const { start } = scheduleTimes(parsed);
    const startLike = start.substring(0, 16) + '%';
    const sessionId = await VideoProcessingModel.findSessionByMeetingStartLike(meeting.id, startLike).catch(() => null);
    return { meetingId: meeting.id, sessionId };
  }
  const sc = /^SCREEN_([^_]+)_Sess(\d+)_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})\.mp4$/i.exec(fileName);
  if (sc) {
    const meeting = await VideoProcessingModel.getMeetingByExternalId(sc[1]).catch(() => null);
    if (!meeting) return { meetingId: null, sessionId: null };
    const startLike = `${sc[3]}-${sc[4]}-${sc[5]} ${sc[6]}:${sc[7]}:%`;
    const sessionId = await VideoProcessingModel.findSessionByMeetingStartLike(meeting.id, startLike).catch(() => null);
    return { meetingId: meeting.id, sessionId };
  }
  return { meetingId: null, sessionId: null };
}

function mp3Exists(fileName) {
  return fs.existsSync(path.join(CONVERTED_DIR, toMp3Name(fileName)));
}

// Report/diarization file availability for a video (PDF-style observation report
// saved to storage/video_diarization by python_engine).
function reportFileNames(fileName) {
  const base = toMp3Name(fileName).replace(/\.mp3$/i, '');
  const canonical = base; // e.g. REC_..._Sess<id>_... 
  const txt = path.join(DIARIZATION_DIR, `${canonical}.report.txt`);
  const json = path.join(DIARIZATION_DIR, `${canonical}.report.json`);
  const diar = path.join(DIARIZATION_DIR, `${canonical}.diarization.txt`);
  return {
    reportTxtExists: fs.existsSync(txt),
    reportJsonExists: fs.existsSync(json),
    diarizationExists: fs.existsSync(diar),
    reportTxtUrl: encodeURI(`/storage/video_diarization/${canonical}.report.txt`),
    reportJsonUrl: encodeURI(`/storage/video_diarization/${canonical}.report.json`),
    diarizationUrl: encodeURI(`/storage/video_diarization/${canonical}.diarization.txt`),
  };
}
// ------------------------------------------------------------------
  // Route-handler methods
  // ------------------------------------------------------------------
const controller = {
  async getAllVideos(req, res) {
    try {
      await VideoProcessingModel.ensureTable();
      const fileNames = await getVideoFiles();
      const videos = [];
      for (const fileName of fileNames) {
        const meta = await getFileMeta(fileName);
        const hasMp3 = mp3Exists(fileName);
        const lastStatus = await VideoProcessingModel.getLatestStatus(fileName);
        const ids = await resolveVideoIds(fileName).catch(() => ({ meetingId: null, sessionId: null }));
        const processed = hasMp3 && await VideoProcessingModel.hasAuditResults(ids.sessionId);

        let status; let canConvert = false; let canProcess = false;
        if (processed) status = 'processed';
        else if (!hasMp3) { status = 'pending'; canConvert = true; }
        else if (lastStatus === 'processing') status = 'processing';
        else if (lastStatus === 'failed') { status = 'failed'; canProcess = true; }
        else { status = 'converted'; canProcess = true; }

        videos.push({
          fileName, size: meta.size, duration: meta.duration, mp3Exists: hasMp3,
          processingStatus: status, processed, canConvert, canProcess,
          videoPath: videoLink(fileName),
          audioPath: hasMp3 ? audioLink(toMp3Name(fileName)) : null,
          meetingId: ids.meetingId, sessionId: ids.sessionId,
          ...reportFileNames(fileName)
        });
      }
      return res.json({ success: true, data: videos });
    } catch (err) {
      console.error('[VideoProcessingController] getAllVideos error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async convertAudio(req, res) {
    try {
      const videoPath = req.body?.videoPath || req.body?.filePath || req.body?.fileName;
      const fileName = safeVideoName(videoPath);
      if (!fileName) return res.status(400).json({ success: false, error: 'Invalid or unsafe video filename.' });

      await VideoProcessingModel.ensureTable();
      const sourcePath = path.join(RECORDINGS_DIR, fileName);
      const targetName = toMp3Name(fileName);
      const targetPath = path.join(CONVERTED_DIR, targetName);

      let seedIds = null;
      try { seedIds = await seedConvertVideo(fileName); }
      catch (seedErr) { console.error('[VideoProcessingController] convert seed error:', seedErr.message || seedErr); }

      if (!fs.existsSync(sourcePath)) return res.status(400).json({ success: false, error: 'Video file not found in storage/screen-recordings.' });
      if (!fs.existsSync(CONVERTED_DIR)) fs.mkdirSync(CONVERTED_DIR, { recursive: true });

      const track = makeTrackRec({ fileName, status: 'converting', mp3Path: targetPath, seed: seedIds });

      if (fs.existsSync(targetPath)) {
        await VideoProcessingModel.saveProcessingRecord({ ...track, status: 'converted' }).catch(() => {});
        if (seedIds && seedIds.meetingId && seedIds.sessionId) await syncAssets(seedIds, targetName, fileName);
        return res.json({ success: true, data: { success: true, alreadyExists: true, mp3Path: targetPath, videoPath: videoLink(fileName), audioPath: audioLink(targetName) } });
      }

      await VideoProcessingModel.saveProcessingRecord(track).catch(() => {});
      // Convert via MoviePy inside python_engine (no direct ffmpeg from Node).
      let converted;
      try {
        converted = await convertVideoToMp3(sourcePath, targetPath);
      } catch (convErr) {
        await VideoProcessingModel.saveProcessingRecord({ ...track, status: 'failed', mp3Path: null }).catch(() => {});
        return res.json({ success: false, data: { success: false, error: convErr.message } });
      }
      if (fs.existsSync(targetPath)) {
        await VideoProcessingModel.saveProcessingRecord({ ...track, status: 'converted' }).catch(() => {});
        if (seedIds && seedIds.meetingId && seedIds.sessionId) await syncAssets(seedIds, targetName, fileName);
        return res.json({ success: true, data: { success: true, alreadyExists: false, mp3Path: targetPath, duration: converted.duration || null, videoPath: videoLink(fileName), audioPath: audioLink(targetName) } });
      }
      await VideoProcessingModel.saveProcessingRecord({ ...track, status: 'failed', mp3Path: null }).catch(() => {});
      return res.json({ success: false, data: { success: false, error: 'MoviePy conversion did not create the MP3 file.' } });
    } catch (err) {
      console.error('[VideoProcessingController] convertAudio error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },
async processAudio(req, res) {
    try {
      const audioPath = req.body?.audioPath || req.body?.filePath || req.body?.fileName;
      const meetingIdInput = req.body?.meetingId || null;
      const sessionIdInput = req.body?.sessionId || null;

      const videoName = safeVideoName(audioPath);
      const mp3Name = /\.mp3$/i.test(String(audioPath)) ? path.basename(String(audioPath)) : toMp3Name(videoName || String(audioPath));
      if (!mp3Name) return res.status(400).json({ success: false, error: 'Invalid audio filename.' });

      await VideoProcessingModel.ensureTable();
      const mp3Path = path.join(CONVERTED_DIR, mp3Name);
      if (!fs.existsSync(mp3Path)) return res.status(400).json({ success: false, error: 'MP3 file is missing. Convert the video to audio before processing.' });

      // Resolve real ids (meeting/session) first so the tracking row is populated.
      let meetingId = meetingIdInput || null;
      let sessionId = sessionIdInput || null;
      if (!meetingId || !sessionId) {
        const ctx = await resolveVideoIds(videoName || mp3Name).catch(() => ({ meetingId: null, sessionId: null }));
        meetingId = meetingId || ctx.meetingId;
        sessionId = sessionId || ctx.sessionId;
      }
      const parsed = parseNamedVideoName(videoName || mp3Name);
      const trackSeed = {
        meetingId, sessionId,
        userId: parsed ? parsed.instructorId : null,
        fileUserId: parsed ? parsed.instructorId : null,
        fileSessionId: parsed ? parsed.sessionId : null,
        fileMeetingId: null,
        firstName: parsed ? parsed.firstName : null,
        lastName: parsed ? parsed.lastName : null,
        externalMeetingId: parsed ? parsed.externalMeetingId : null,
        title: parsed ? parsed.title : null
      };

      // Duplicate-session guard (via the video_processing identification table).
      const dup = parsed && sessionId ? await VideoProcessingModel.findDuplicateSession(trackSeed.userId, sessionId).catch(() => null) : null;
      if (dup && dup.file_name && dup.file_name.toLowerCase() === mp3Name.toLowerCase() && dup.status === 'processed') {
        return res.json({ success: true, data: { success: true, alreadyExists: true, mp3Path, audioPath: audioLink(mp3Name), duplicate: true } });
      }

      await VideoProcessingModel.saveProcessingRecord(makeTrackRec({ fileName: mp3Name, status: 'processing', mp3Path, seed: trackSeed })).catch(() => {});
      try {
        const result = await runPythonEngine(mp3Name, {
          aiSettings: { meeting_id: meetingId, session_id: sessionId },
          // 'tiny' is much faster on CPU (no GPU). Use 'base'/'small' for better
          // accuracy if slower speed is acceptable.
          model: process.env.PYTHON_ENGINE_MODEL || 'tiny'
        });
        if (result && result.success === false) {
          await VideoProcessingModel.saveProcessingRecord(makeTrackRec({ fileName: mp3Name, status: 'failed', mp3Path, seed: trackSeed })).catch(() => {});
          return res.json({ success: false, data: { success: false, error: result.error || 'Audio processing returned an error.' } });
        }

        // STEP 6: diarization health check - if one speaker covers >90% of the
        // session, mark this recording as needing reprocessing so failed
        // diarization jobs can be identified and re-run in bulk.
        let needsReprocessing = false;
        const health = result?.diarization_health;
        if (health && health.healthy === false) {
          needsReprocessing = true;
          await VideoProcessingModel.markNeedsReprocessing(mp3Name).catch(() => {});
          console.warn(`[VideoProcessingController] diarization unhealthy for ${mp3Name}: ${health.reason || 'unknown'} -> marked needs_reprocessing`);
        }

        await VideoProcessingModel.saveProcessingRecord(makeTrackRec({ fileName: mp3Name, status: 'processed', mp3Path, seed: trackSeed })).catch(() => {});
        return res.json({
          success: true,
          data: {
            success: true, alreadyExists: true, mp3Path,
            audioPath: audioLink(mp3Name),
            needsReprocessing,
            diarizationHealth: health || null
          }
        });
      } catch (err) {
        console.error('[VideoProcessingController] processAudio pipeline error:', err.message || err);
        await VideoProcessingModel.saveProcessingRecord(makeTrackRec({ fileName: mp3Name, status: 'failed', mp3Path, seed: trackSeed })).catch(() => {});
        return res.json({ success: false, data: { success: false, error: 'Audio processing failed: ' + (err.message || 'unknown error') } });
      }
    } catch (err) {
      console.error('[VideoProcessingController] processAudio error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async getProcessingHistory(req, res) {
    try {
      const rows = await VideoProcessingModel.getProcessingHistory();
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error('[VideoProcessingController] getProcessingHistory error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

/** Write the "Conversion" meeting_assets row + session file names (side effect). */
async function syncAssets(seed, mp3Name, videoName) {
  try {
    const transcriptName = mp3Name.replace(/^REC_/i, 'TRANS_').replace(/\.mp3$/i, '.txt');
    await VideoProcessingModel.updateSessionFileNames(seed.sessionId, mp3Name, transcriptName).catch(() => {});
    await VideoProcessingModel.insertMeetingAsset({
      meetingId: seed.meetingId, sessionId: seed.sessionId,
      mp3Name, transcriptName, videoPath: path.join(RECORDINGS_DIR, videoName)
    }).catch(() => {});
  } catch (e) { /* non-fatal */ }
}

module.exports = controller;