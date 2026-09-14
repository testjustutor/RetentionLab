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
const VideoProcessingModel = require('../../../models/super_admin/content/VideoProcessingModel');
const { convertVideoToMp3 } = require('../../../services/engine/python_runner');
const axios = require('axios');
// Same audio-processing pipeline Flow 1 (the meeting bot, services/socraticbot.js)
// uses: Whisper transcription -> AI rubric audit -> tutor eval -> summary ->
// DB persistence. The admin video-processing flow now converges onto this
// SAME pipeline after video -> mp3 conversion instead of running its own
// separate pipeline.py-based engine (see processAudio() below).
const PythonBridge = require('../../../services/shared/pythonBridge');
const TranscriptValidator = require('../../../services/shared/transcriptValidator');
const { exec, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const RECORDINGS_DIR = path.join(ROOT_DIR, 'storage', 'screen-recordings');
const CONVERTED_DIR = path.join(ROOT_DIR, 'storage', 'recordings');
// Same established cache folders the python_engine pipeline now writes into
// (see services/engine/pipeline.py + orchestrator/pipeline_context.py) -
// storage/video_diarization is no longer used/written by the engine.
const TRANSCRIPTS_DIR = path.join(ROOT_DIR, 'storage', 'cache_audio_transcripts');
const AUDITS_DIR = path.join(ROOT_DIR, 'storage', 'cache_audits');
// AI Transcript (Deepgram) output — deliberately separate from
// storage/cache_audio_transcripts (the Whisper pipeline's diarization output
// above) so the two never collide or get confused for one another.
const DEEPGRAM_DIR = path.join(ROOT_DIR, 'storage', 'cache_deepgram_transcripts');

const SAFE_NAME_RE = /^[A-Za-z0-9_.\-\s]+\.mp4$/i;

// video_processing.mp3_path is stored relative to the project root (e.g.
// "storage\recordings\REC_Meet1_Sess1_....mp3"), not an absolute filesystem
// path - the absolute path is still what's used for actual fs/ffmpeg work,
// this only affects what gets written to the DB tracking row.
function toRelativeStoragePath(absPath) {
  if (!absPath) return null;
  return path.isAbsolute(absPath) ? path.relative(ROOT_DIR, absPath) : absPath;
}

// ------------------------------------------------------------------
// Response / metadata caches (per-process, TTL'd) - keeps repeated
// page loads (including 304 not-modified checks) fast without any DB writes.
// ------------------------------------------------------------------
const RESPONSE_TTL_MS = 15000;          // how long a GET response stays valid
const FFPROBE_TTL_MS = 30000;           // how long ffprobe metadata is reused
let cachedGetResponse = null;           // { at, data } for the assembled JSON
const fileMetaCache = new Map();        // fileName -> { at, mtimeMs, size, meta }

function invalidateCaches() {
  cachedGetResponse = null;
  fileMetaCache.clear();
}

/** Run `items` through `fn` with at most `limit` concurrent workers, preserving order. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  };
  const workers = [];
  const n = Math.max(1, Math.min(limit, items.length));
  for (let i = 0; i < n; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

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

/**
 * Build the converted-audio filename for a source video.
 *
 * Naming pattern: REC_Meet<meetingId>_Sess<sessionId>_<YYYY>_<MM>_<DD>_<HH-MM>.mp3
 * using the REAL database ids (meetings.id / meeting_sessions.id) - NOT the
 * external/file-embedded meeting id or the session number parsed out of the
 * original filename, which are arbitrary and not guaranteed unique.
 *
 * meetingId/sessionId must be resolved first via resolveVideoIds(fileName) or
 * seedConvertVideo(fileName) (both return the real DB ids) and passed in here.
 * When they aren't available yet (unrecognized filename format, or the
 * meeting/session hasn't been seeded/resolved at this call site), falls back
 * to a name derived purely from the source filename so this never throws -
 * callers that need the FINAL real-id name must resolve ids first.
 */
function toMp3Name(fileName, meetingId, sessionId) {
  const parsed = parseNamedVideoName(fileName);
  let Y, M, D, HM;
  if (parsed) {
    const { start } = scheduleTimes(parsed);
    const [ymd, hms] = start.split(' ');
    [Y, M, D] = ymd.split('-');
    HM = hms.substring(0, 5).replace(':', '-');
  } else {
    const sc = /^SCREEN_([^_]+)_Sess(\d+)_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})\.mp4$/i.exec(fileName);
    if (sc) {
      Y = sc[3]; M = sc[4]; D = sc[5];
      HM = `${sc[6]}-${sc[7]}`;
    }
  }
  if (meetingId != null && sessionId != null && Y) {
    return `REC_Meet${meetingId}_Sess${sessionId}_${Y}_${M}_${D}_${HM}.mp3`;
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

/**
 * Resolve or create the REAL session for a NAMED-VIDEO file, keyed on the
 * raw (instructor, file-embedded session number) pair rather than purely on
 * computed date/time. Two different admin-named recordings can legitimately
 * parse to the IDENTICAL start/end (human-typed filenames aren't always
 * precise to the second) while carrying different embedded session numbers
 * - e.g. "..._247411_...-20260817_092941.mp4" vs "..._247412_...-20260817_092941.mp4".
 * Blindly matching by time would collapse those into one session. So:
 *   1) if this exact raw id pair has already been resolved once (via
 *      video_processing), reuse that same real session - idempotent
 *      re-conversion of the same file.
 *   2) otherwise, look for a session at the exact computed time; only reuse
 *      it if nothing else has already claimed it under a DIFFERENT raw id
 *      pair - if it's already claimed, this is genuinely a different
 *      recording that happens to share a timestamp, so a new session is
 *      created for it instead of reusing the other file's session.
 *   3) otherwise create a new session as usual.
 */
async function resolveOrCreateNamedSession(meetingId, instructorId, rawSessionId, start, end) {
  const byRawIds = await VideoProcessingModel.getMappingByVideoIds(instructorId, rawSessionId).catch(() => null);
  if (byRawIds && Number(byRawIds.meetingId) === Number(meetingId) && byRawIds.sessionId != null) {
    return Number(byRawIds.sessionId);
  }

  const existing = await VideoProcessingModel.findSessionByMeetingTime(meetingId, start, end).catch(() => null);
  if (existing && existing.id) {
    const claimant = await VideoProcessingModel.getClaimantForSession(meetingId, Number(existing.id)).catch(() => null);
    const claimedByOther = claimant && (
      Number(claimant.videoUserId) !== Number(instructorId) ||
      Number(claimant.videoSessionId) !== Number(rawSessionId)
    );
    if (!claimedByOther) return Number(existing.id);
    // Fall through - this time slot already belongs to a different recording.
  }

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

  const sessionId = await resolveOrCreateNamedSession(meeting.id, parsed.instructorId, parsed.sessionId, start, end);
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
 * Screen-recording seed. SCREEN_ files are written directly by the meeting
 * bot (services/screenRecorder.js, driven by services/socraticbot.js) as
 * SCREEN_<meetings.id>_Sess<meeting_sessions.id>_<date>_<time>.mp4 - the two
 * numbers in the filename are the REAL database ids already. So this first
 * tries to resolve straight to that real, existing meeting/session (never
 * fabricating data for a recording the bot already tracked for real - and
 * never conflating two different bot recordings that only differ by their
 * embedded session id). Only when that direct lookup doesn't check out
 * (e.g. a manually renamed/legacy file whose leading segment is genuinely
 * an external_meeting_id string, not a numeric meetings.id) does it fall
 * back to the original behaviour: reuse/create a default system-convert
 * instructor, upsert a meeting and resolve/create a session by time.
 */
async function seedScreenVideo(fileName) {
  const m = /^SCREEN_([^_]+)_Sess(\d+)_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})\.mp4$/i.exec(fileName);
  if (!m) return { success: false, error: 'Invalid screen video filename format.' };
  const externalMeetingId = m[1];
  const fileSessionId = Number(m[2]);

  const directMeetingId = Number(m[1]);
  if (Number.isFinite(directMeetingId) && Number.isFinite(fileSessionId)) {
    const sessionRow = await VideoProcessingModel.getSessionById(fileSessionId).catch(() => null);
    if (sessionRow && Number(sessionRow.meeting_id) === directMeetingId) {
      const meetingRow = await VideoProcessingModel.getMeetingById(directMeetingId).catch(() => null);
      if (meetingRow) {
        const owner = meetingRow.created_by
          ? await VideoProcessingModel.getUserById(meetingRow.created_by).catch(() => null)
          : null;
        return {
          success: true,
          data: {
            meetingId: directMeetingId, sessionId: fileSessionId,
            instructorId: owner ? owner.id : null,
            externalMeetingId: meetingRow.external_meeting_id || String(directMeetingId),
            title: meetingRow.title || ('Screen Recording ' + directMeetingId),
            fileUserId: null, fileSessionId, fileMeetingId: null,
            firstName: owner ? owner.first_name : 'System',
            lastName: owner ? owner.last_name : 'Converter'
          }
        };
      }
    }
  }

  // Fallback: legacy/renamed screen file - reconcile by time as before.
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
 *    - file-origin : video_user_id / video_session_id (parsed straight out
 *                    of the video filename, before any DB matching)
 *    - resolved DB : user_id / meeting_id / session_id
 *  video_meeting_type says what kind of raw id the filename carried
 *  ('session' - the only kind either filename format actually embeds).
 */
function makeTrackRec({ fileName, status, mp3Path, seed }) {
  const videoUserId = seed?.fileUserId ?? seed?.userId ?? null;
  const videoSessionId = seed?.fileSessionId ?? null;
  const videoMeetingType = videoSessionId != null ? 'session' : null;

  return {
    fileName,
    status,
    mp3Path: toRelativeStoragePath(mp3Path),

    // file-origin ids (parsed from the video filename, pre-DB-matching)
    videoUserId,
    videoSessionId,
    videoMeetingType,
    meetingType: videoMeetingType || 'teams',

    // real DB ids (users.id / meetings.id / meeting_sessions.id)
    userId: seed?.userId ?? null,
    meetingId: seed?.meetingId ?? null,
    sessionId: seed?.sessionId ?? null,

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
  const st = fs.statSync(filePath);

  // Serve cached metadata when the file hasn't changed on disk.
  const cached = fileMetaCache.get(fileName);
  if (cached && cached.size === st.size && cached.mtimeMs === st.mtimeMs && Date.now() - cached.at < FFPROBE_TTL_MS) {
    return cached.meta;
  }

  const sizeMB = (st.size / (1024 * 1024)).toFixed(2);
  const meta = await new Promise((resolve) => {
    execFile('ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      { timeout: 15000, windowsHide: true },
      (error, stdout) => {
        if (error) return resolve({ size: sizeMB, duration: '0:00', exists: true });
        resolve({ size: sizeMB, duration: formatDuration(Number.parseFloat(stdout.trim())), exists: true });
      });
  });
  fileMetaCache.set(fileName, { at: Date.now(), size: st.size, mtimeMs: st.mtimeMs, meta });
  return meta;
}

async function resolveVideoIds(fileName, providedSessionId = null) {
  // 0) Prefer the persisted video_processing mapping (file_name -> real
  //    meeting_id/session_id) over re-deriving it from the filename via
  //    meetings/meeting_sessions lookups every time this runs - the table is
  //    the durable video -> normal-pipeline id mapping once a file has been
  //    converted/processed at least once (see makeTrackRec / saveProcessingRecord).
  const cached = await VideoProcessingModel.getMappingByFileName(fileName).catch(() => null);
  if (cached) return cached;

  const parsed = parseNamedVideoName(fileName);
  let resolved = { meetingId: null, sessionId: null };

  if (parsed) {
    // 0b) Exact cache by the RAW filename-embedded id pair (instructor +
    // the file's own session number). This is the ONLY reliable way to
    // distinguish two admin-named recordings whose filenames happen to
    // parse to the IDENTICAL date/time (human-typed filenames aren't always
    // precise to the second) but carry different embedded session numbers -
    // once this exact pair has been resolved once (via an actual convert/
    // process call), it always resolves to that same real session again.
    const byRawIds = await VideoProcessingModel.getMappingByVideoIds(parsed.instructorId, parsed.sessionId).catch(() => null);
    if (byRawIds) {
      resolved = byRawIds;
    } else {
      const meeting = await VideoProcessingModel.getMeetingByExternalId(parsed.externalMeetingId).catch(() => null);
      if (meeting) {
        // Match the EXACT start/end this session would have been seeded with
        // (see resolveOrCreateNamedSession/seedNamedVideo - same
        // scheduleTimes() computation) first, so two sessions of the same
        // meeting that merely fall in the same minute are never conflated.
        // Only fall back to the minute-truncated LIKE match for legacy rows
        // whose end_time doesn't follow the exact start+1hr convention.
        const { start, end } = scheduleTimes(parsed);
        const exactRow = await VideoProcessingModel.findSessionByMeetingTime(meeting.id, start, end).catch(() => null);
        let sessionId = exactRow ? Number(exactRow.id) : null;
        if (sessionId == null) {
          const startLike = start.substring(0, 16) + '%';
          sessionId = await VideoProcessingModel.findSessionByMeetingStartLike(meeting.id, startLike).catch(() => null);
        }
        if (sessionId != null) {
          // Guard against showing this file as sharing a session that a
          // DIFFERENT raw recording has already claimed - until THIS file
          // is actually converted/processed and gets its own session, show
          // it as unresolved rather than borrowing another file's session.
          const claimant = await VideoProcessingModel.getClaimantForSession(meeting.id, sessionId).catch(() => null);
          const claimedByOther = claimant && (
            Number(claimant.videoUserId) !== Number(parsed.instructorId) ||
            Number(claimant.videoSessionId) !== Number(parsed.sessionId)
          );
          resolved = { meetingId: meeting.id, sessionId: claimedByOther ? null : sessionId };
        } else {
          resolved = { meetingId: meeting.id, sessionId: null };
        }
      }
    }
  } else {
    const sc = /^SCREEN_([^_]+)_Sess(\d+)_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})\.mp4$/i.exec(fileName);
    if (sc) {
      // SCREEN_ files are written directly by the meeting bot
      // (services/screenRecorder.js, driven by services/socraticbot.js) as
      // SCREEN_<meetings.id>_Sess<meeting_sessions.id>_<date>_<time>.mp4 -
      // sc[1]/sc[2] are the REAL database ids already, not values that need
      // matching/lookup. Trust them once verified they refer to an actual,
      // consistent meeting+session pair - this is what keeps two bot-recorded
      // files for the same meeting that only differ by session id from ever
      // resolving to the wrong (or the same) session.
      const directMeetingId = Number(sc[1]);
      const directSessionId = Number(sc[2]);
      if (Number.isFinite(directMeetingId) && Number.isFinite(directSessionId)) {
        const sessionRow = await VideoProcessingModel.getSessionById(directSessionId).catch(() => null);
        if (sessionRow && Number(sessionRow.meeting_id) === directMeetingId) {
          resolved = { meetingId: directMeetingId, sessionId: directSessionId };
        }
      }
      // Fallback for filenames where sc[1] is genuinely an external_meeting_id
      // string rather than this app's numeric meetings.id (or the direct ids
      // above didn't check out) - reconcile by time instead, as before.
      if (resolved.meetingId == null) {
        const meeting = await VideoProcessingModel.getMeetingByExternalId(sc[1]).catch(() => null);
        if (meeting) {
          const startLike = `${sc[3]}-${sc[4]}-${sc[5]} ${sc[6]}:${sc[7]}:%`;
          const sessionId = await VideoProcessingModel.findSessionByMeetingStartLike(meeting.id, startLike).catch(() => null);
          resolved = { meetingId: meeting.id, sessionId };
        }
      }
    }
  }

  // Newly-resolved mapping: backfill any existing video_processing row(s) for
  // this file that don't have it yet, so the table stays up to date and the
  // next call here is a cache hit via step 0.
  if (resolved.meetingId != null && resolved.sessionId != null) {
    await VideoProcessingModel.backfillMapping(fileName, resolved.meetingId, resolved.sessionId).catch(() => {});
  }

  return resolved;
}

function mp3Exists(fileName, meetingId, sessionId) {
  return fs.existsSync(path.join(CONVERTED_DIR, toMp3Name(fileName, meetingId, sessionId)));
}

// Same base_id stem the python_engine pipeline uses for every cached file
// (services/engine/orchestrator/pipeline_context.py::compute_base_id) -
// strips the extension and, when present, the "REC_" prefix. Mirrors that
// function exactly so these paths always match what the engine actually wrote.
function computeBaseId(fileName) {
  const noExt = path.basename(fileName, path.extname(fileName));
  return noExt.startsWith('REC_') ? noExt.split('REC_').join('') : noExt;
}

// Report/diarization file availability for a video. The observation report
// (PDF-style) is saved to storage/cache_audits/AUDIT_REPORT_<base_id>.*, and
// the speaker-labelled diarization transcript to
// storage/cache_audio_transcripts/DIARIZED_TRANS_<base_id>.diarization.* -
// the SAME established cache folders + <PREFIX>_<base_id> naming convention
// the rest of the engine uses (see services/engine/pipeline.py).
function reportFileNames(fileName, meetingId, sessionId) {
  const mp3Base = toMp3Name(fileName, meetingId, sessionId).replace(/\.mp3$/i, ''); // e.g. REC_Meet<id>_Sess<id>_...
  const baseId = computeBaseId(mp3Base);
  const txt = path.join(AUDITS_DIR, `AUDIT_REPORT_${baseId}.report.txt`);
  const json = path.join(AUDITS_DIR, `AUDIT_REPORT_${baseId}.report.json`);
  const diar = path.join(TRANSCRIPTS_DIR, `DIARIZED_TRANS_${baseId}.diarization.txt`);
  return {
    reportTxtExists: fs.existsSync(txt),
    reportJsonExists: fs.existsSync(json),
    diarizationExists: fs.existsSync(diar),
    reportTxtUrl: encodeURI(`/storage/cache_audits/AUDIT_REPORT_${baseId}.report.txt`),
    reportJsonUrl: encodeURI(`/storage/cache_audits/AUDIT_REPORT_${baseId}.report.json`),
    diarizationUrl: encodeURI(`/storage/cache_audio_transcripts/DIARIZED_TRANS_${baseId}.diarization.txt`),
  };
}

// AI Transcript (Deepgram) file availability for a video, same base_id
// scheme as reportFileNames() above but its own DEEPGRAM_DIR/prefix.
function transcriptFileNames(fileName, meetingId, sessionId) {
  const mp3Base = toMp3Name(fileName, meetingId, sessionId).replace(/\.mp3$/i, '');
  const baseId = computeBaseId(mp3Base);
  const json = path.join(DEEPGRAM_DIR, `DEEPGRAM_TRANS_${baseId}.json`);
  const txt = path.join(DEEPGRAM_DIR, `DEEPGRAM_TRANS_${baseId}.txt`);
  return {
    transcriptExists: fs.existsSync(json),
    transcriptJsonUrl: encodeURI(`/storage/cache_deepgram_transcripts/DEEPGRAM_TRANS_${baseId}.json`),
    transcriptTxtUrl: encodeURI(`/storage/cache_deepgram_transcripts/DEEPGRAM_TRANS_${baseId}.txt`),
  };
}

/** Deepgram API key, read fresh from env each call (never cached/logged). */
function getDeepgramApiKey() {
  return process.env.DEEPGRAM_API_KEY || null;
}

/**
 * Call Deepgram's prerecorded /v1/listen REST API directly with the mp3's
 * raw bytes (no SDK — matches the rest of this codebase's pattern of plain
 * axios calls to third-party APIs). diarize+utterances give us per-speaker
 * turns; smart_format+punctuate make the text readable.
 */
async function callDeepgram(mp3Path, apiKey) {
  const audioBuffer = fs.readFileSync(mp3Path);
  const response = await axios.post(
    'https://api.deepgram.com/v1/listen',
    audioBuffer,
    {
      params: { model: 'nova-2', smart_format: true, punctuate: true, diarize: true, utterances: true },
      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'audio/mpeg' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120000
    }
  );
  return response.data;
}

/** Shape Deepgram's raw response into what the frontend/txt file expect. */
function shapeDeepgramResult(raw) {
  const results = raw?.results || {};
  const alt = results.channels?.[0]?.alternatives?.[0] || {};
  const utterances = Array.isArray(results.utterances) ? results.utterances : [];
  const segments = utterances.map(u => ({
    speaker: `Speaker ${u.speaker ?? 0}`,
    start: u.start ?? 0,
    end: u.end ?? 0,
    text: u.transcript || ''
  }));
  const speakers = [...new Set(segments.map(s => s.speaker))];
  return {
    transcript: alt.transcript || '',
    segments,
    speakers,
    duration: raw?.metadata?.duration ?? null
  };
}

function transcriptTxtBody(shaped) {
  const fmt = (t) => new Date((t || 0) * 1000).toISOString().substring(11, 19);
  if (!shaped.segments.length) return shaped.transcript || '(empty transcript)';
  return shaped.segments.map(s => `[${fmt(s.start)} - ${fmt(s.end)}] ${s.speaker}: ${s.text}`).join('\n');
}
// ------------------------------------------------------------------
  // Route-handler methods
  // ------------------------------------------------------------------
const controller = {
  async getAllVideos(req, res) {
    try {
      // Serve a cached response when one was computed recently. The 304
      // not-modified path still calls this handler, so this is what makes
      // repeated page loads fast without hitting ffprobe or the DB.
      if (cachedGetResponse && Date.now() - cachedGetResponse.at < RESPONSE_TTL_MS) {
        return res.json(cachedGetResponse.data);
      }

      const fileNames = await getVideoFiles();
      if (!fileNames.length) {
        const empty = { success: true, data: [] };
        cachedGetResponse = { at: Date.now(), data: empty };
        return res.json(empty);
      }

      // 1) Resolve the REAL DB meeting/session ids first - the REC_ filename
      // (and therefore mp3Exists/reportFileNames below) is now built from
      // these ids, not from anything parsed out of the source filename.
      // Bulk-check the video_processing mapping table for all files in one
      // query first; only files with no persisted mapping yet fall through
      // to per-file live resolution (which then backfills the table).
      const mappedCache = await VideoProcessingModel.getMappingsByFileNames(fileNames).catch(() => ({}));
      const sessions = await mapWithConcurrency(fileNames, 4, (fileName) =>
        mappedCache[fileName]
          ? Promise.resolve(mappedCache[fileName])
          : resolveVideoIds(fileName).catch(() => ({ meetingId: null, sessionId: null })));

      // 2) ffprobe metadata & mp3/report existence in parallel (bounded).
      const metas = await mapWithConcurrency(fileNames, 4, async (fileName, i) => ({
        fileName,
        meta: await getFileMeta(fileName),
        hasMp3: mp3Exists(fileName, sessions[i].meetingId, sessions[i].sessionId)
      }));

      // 3) statuses for all files in one query.
      const statusMap = await VideoProcessingModel.getLatestStatuses(fileNames).catch(() => ({}));

      // 4) audit flags for all sessions in one query.
      const auditMap = await VideoProcessingModel.hasAuditResultsBatch(sessions.map(s => s.sessionId)).catch(() => ({}));

      const videos = fileNames.map((fileName, i) => {
        const meta = metas[i].meta;
        const hasMp3 = metas[i].hasMp3;
        const lastStatus = statusMap[fileName];
        const ids = sessions[i];
        const hasAuditData = ids.sessionId ? (auditMap[String(ids.sessionId)] === true) : false;
        const processed = hasMp3 && hasAuditData;

        let status; let canConvert = false; let canProcess = false;
        if (processed) status = 'processed';
        else if (!hasMp3) { status = 'pending'; canConvert = true; }
        else if (lastStatus === 'processing') status = 'processing';
        else if (lastStatus === 'failed') { status = 'failed'; canProcess = true; }
        // Pre-audit transcript validation skipped this recording (empty/
        // single-speaker-only) - its own distinct, non-error status rather
        // than falling into "converted" (which would look re-processable
        // with no explanation of why it never got a report).
        else if (lastStatus === 'skipped') { status = 'skipped'; canProcess = true; }
        else { status = 'converted'; canProcess = true; }

        return {
          fileName, size: meta.size, duration: meta.duration, mp3Exists: hasMp3,
          processingStatus: status, processed, canConvert, canProcess,
          hasAuditData,
          auditReportUrl: ids.sessionId ? `/api/super_admin/settings/video-processing/report?sessionId=${ids.sessionId}` : null,
          videoPath: videoLink(fileName),
          audioPath: hasMp3 ? audioLink(toMp3Name(fileName, ids.meetingId, ids.sessionId)) : null,
          meetingId: ids.meetingId, sessionId: ids.sessionId,
          ...reportFileNames(fileName, ids.meetingId, ids.sessionId),
          ...transcriptFileNames(fileName, ids.meetingId, ids.sessionId)
        };
      });

      const payload = { success: true, data: videos };
      cachedGetResponse = { at: Date.now(), data: payload };
      return res.json(payload);
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

      // Resolve/create the REAL meeting + session rows FIRST so the output
      // filename can be built from their real DB ids (REC_Meet<id>_Sess<id>_...)
      // instead of anything parsed out of the source filename.
      let seedIds = null;
      try { seedIds = await seedConvertVideo(fileName); }
      catch (seedErr) { console.error('[VideoProcessingController] convert seed error:', seedErr.message || seedErr); }

      const targetName = toMp3Name(fileName, seedIds?.meetingId, seedIds?.sessionId);
      const targetPath = path.join(CONVERTED_DIR, targetName);

      if (!fs.existsSync(sourcePath)) return res.status(400).json({ success: false, error: 'Video file not found in storage/screen-recordings.' });
      if (!fs.existsSync(CONVERTED_DIR)) fs.mkdirSync(CONVERTED_DIR, { recursive: true });

      const track = makeTrackRec({ fileName, status: 'converting', mp3Path: targetPath, seed: seedIds });

      if (fs.existsSync(targetPath)) {
        await VideoProcessingModel.saveProcessingRecord({ ...track, status: 'converted' }).catch(() => {});
        if (seedIds && seedIds.meetingId && seedIds.sessionId) await syncAssets(seedIds, targetName, fileName);
        invalidateCaches();
        return res.json({ success: true, data: { success: true, alreadyExists: true, mp3Path: targetPath, videoPath: videoLink(fileName), audioPath: audioLink(targetName) } });
      }

      await VideoProcessingModel.saveProcessingRecord(track).catch(() => {});
      invalidateCaches();
      // Convert via MoviePy inside python_engine (no direct ffmpeg from Node).
      let converted;
      try {
        converted = await convertVideoToMp3(sourcePath, targetPath);
      } catch (convErr) {
        await VideoProcessingModel.saveProcessingRecord({ ...track, status: 'failed', mp3Path: null }).catch(() => {});
        invalidateCaches();
        return res.json({ success: false, data: { success: false, error: convErr.message } });
      }
      if (fs.existsSync(targetPath)) {
        await VideoProcessingModel.saveProcessingRecord({ ...track, status: 'converted' }).catch(() => {});
        if (seedIds && seedIds.meetingId && seedIds.sessionId) await syncAssets(seedIds, targetName, fileName);
        invalidateCaches();
        return res.json({ success: true, data: { success: true, alreadyExists: false, mp3Path: targetPath, duration: converted.duration || null, videoPath: videoLink(fileName), audioPath: audioLink(targetName) } });
      }
      await VideoProcessingModel.saveProcessingRecord({ ...track, status: 'failed', mp3Path: null }).catch(() => {});
      invalidateCaches();
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

      // Resolve real ids (meeting/session) FIRST - needed both to build the
      // REC_Meet<id>_Sess<id>_... filename below (when audioPath is a video
      // path rather than an already-converted mp3) and so the tracking row is
      // populated AND so the same real DB ids get forwarded through
      // pythonBridge.js into the engine (see PipelineContext's explicit
      // meeting_id/session_id override) instead of letting it re-derive them
      // from the filename, which can resolve to the WRONG meeting for
      // "named video" recordings whose external_meeting_id segment (e.g.
      // "Regular") is not unique.
      let meetingId = meetingIdInput || null;
      let sessionId = sessionIdInput || null;
      if (!meetingId || !sessionId) {
        const ctx = await resolveVideoIds(videoName || String(audioPath)).catch(() => ({ meetingId: null, sessionId: null }));
        meetingId = meetingId || ctx.meetingId;
        sessionId = sessionId || ctx.sessionId;
      }

      const mp3Name = /\.mp3$/i.test(String(audioPath)) ? path.basename(String(audioPath)) : toMp3Name(videoName || String(audioPath), meetingId, sessionId);
      if (!mp3Name) return res.status(400).json({ success: false, error: 'Invalid audio filename.' });

      await VideoProcessingModel.ensureTable();
      const mp3Path = path.join(CONVERTED_DIR, mp3Name);
      if (!fs.existsSync(mp3Path)) return res.status(400).json({ success: false, error: 'MP3 file is missing. Convert the video to audio before processing.' });

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
        // CONVERGENCE: this used to spawn the separate pipeline.py engine via
        // runPythonEngine() (python_main.py: AssemblyAI transcription + its
        // own diarization health-check + observation-report). It now calls
        // the EXACT SAME entry point Flow 1 (the meeting bot) uses, so both
        // flows run one audio-processing pipeline end to end: Whisper
        // transcription -> AI rubric audit -> tutor eval (writes
        // meeting_session_scores) -> summary -> DB persistence. This also
        // means the pipeline.py-only diarization-health/"needs_reprocessing"
        // check and the AssemblyAI word_boost proper-name boost no longer
        // apply here, since Flow 1's pipeline has no equivalent step.
        const result = await PythonBridge.runFullAudioPipeline(meetingId, sessionId, mp3Name);

        if (!result || result.success === false) {
          await VideoProcessingModel.saveProcessingRecord(makeTrackRec({ fileName: mp3Name, status: 'failed', mp3Path, seed: trackSeed })).catch(() => {});
          invalidateCaches();
          return res.json({ success: false, data: { success: false, error: (result && result.error) || 'Audio processing returned an error.' } });
        }

        // Pre-audit transcript validation (services/engine/transcript_validation.py)
        // found this recording empty/near-empty or single-speaker-only and the
        // engine skipped the AI audit/summary/persistence entirely - NOT an
        // error (nothing went wrong) and NOT "processed" (there's no report),
        // so it gets its own friendly, non-error status/response.
        if (result.skipped) {
          await VideoProcessingModel.saveProcessingRecord(makeTrackRec({ fileName: mp3Name, status: 'skipped', mp3Path, seed: trackSeed })).catch(() => {});
          invalidateCaches();
          return res.json({
            success: true,
            data: {
              success: true,
              skipped: true,
              skipReason: result.skipReason || null,
              skipMessage: result.skipMessage || 'This recording had no meaningful conversation to audit, so the report was skipped.',
              mp3Path,
              audioPath: audioLink(mp3Name),
              meetingId: result.meetingId ?? meetingId,
              sessionId: result.sessionId ?? sessionId
            }
          });
        }

        await VideoProcessingModel.saveProcessingRecord(makeTrackRec({ fileName: mp3Name, status: 'processed', mp3Path, seed: trackSeed })).catch(() => {});
        invalidateCaches();
        return res.json({
          success: true,
          data: {
            success: true, alreadyExists: true, mp3Path,
            audioPath: audioLink(mp3Name),
            meetingId: result.meetingId ?? meetingId,
            sessionId: result.sessionId ?? sessionId,
            oqiScore: result.auditResult ? result.auditResult.oqi_score : null
          }
        });
      } catch (err) {
        console.error('[VideoProcessingController] processAudio pipeline error:', err.message || err);
        await VideoProcessingModel.saveProcessingRecord(makeTrackRec({ fileName: mp3Name, status: 'failed', mp3Path, seed: trackSeed })).catch(() => {});
        invalidateCaches();
        return res.json({ success: false, data: { success: false, error: 'Audio processing failed: ' + (err.message || 'unknown error') } });
      }
    } catch (err) {
      console.error('[VideoProcessingController] processAudio error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * AI Transcript: calls Deepgram's prerecorded API directly on the already-
   * converted mp3 (no Whisper, no audit/report pipeline — just a fast
   * speaker-labelled transcript). Requires DEEPGRAM_API_KEY in .env.
   */
  async generateTranscript(req, res) {
    try {
      const apiKey = getDeepgramApiKey();
      if (!apiKey) {
        return res.json({ success: false, data: { success: false, error: 'DEEPGRAM_API_KEY is not set in .env — add it and restart the server before using AI Transcript.' } });
      }

      const audioPath = req.body?.audioPath || req.body?.filePath || req.body?.fileName;
      const meetingId = req.body?.meetingId || null;
      const sessionId = req.body?.sessionId || null;

      const videoName = safeVideoName(audioPath);
      const mp3Name = /\.mp3$/i.test(String(audioPath)) ? path.basename(String(audioPath)) : toMp3Name(videoName || String(audioPath), meetingId, sessionId);
      if (!mp3Name) return res.status(400).json({ success: false, error: 'Invalid audio filename.' });

      const mp3Path = path.join(CONVERTED_DIR, mp3Name);
      if (!fs.existsSync(mp3Path)) return res.status(400).json({ success: false, error: 'MP3 file is missing. Convert the video to audio before generating a transcript.' });

      const baseId = computeBaseId(mp3Name.replace(/\.mp3$/i, ''));
      if (!fs.existsSync(DEEPGRAM_DIR)) fs.mkdirSync(DEEPGRAM_DIR, { recursive: true });
      const jsonPath = path.join(DEEPGRAM_DIR, `DEEPGRAM_TRANS_${baseId}.json`);
      const txtPath = path.join(DEEPGRAM_DIR, `DEEPGRAM_TRANS_${baseId}.txt`);

      let shaped;
      try {
        const raw = await callDeepgram(mp3Path, apiKey);
        shaped = shapeDeepgramResult(raw);
      } catch (dgErr) {
        const dgMessage = dgErr.response?.data?.err_msg || dgErr.response?.data?.reason || dgErr.message || 'Deepgram request failed.';
        console.error('[VideoProcessingController] generateTranscript Deepgram error:', dgMessage);
        return res.json({ success: false, data: { success: false, error: 'Deepgram error: ' + dgMessage } });
      }

      // Skip persisting a blank/meaningless Deepgram transcript (e.g. a
      // recording with little or no spoken content) - friendly, non-error
      // outcome instead of saving a near-empty .json/.txt pair.
      const validation = TranscriptValidator.validateTranscript(shaped.transcript);
      if (!validation.valid) {
        return res.json({
          success: true,
          data: {
            success: true,
            skipped: true,
            skipReason: validation.reason,
            skipMessage: validation.message
          }
        });
      }

      fs.writeFileSync(jsonPath, JSON.stringify({
        fileName: mp3Name, meetingId, sessionId, generatedAt: new Date().toISOString(),
        duration: shaped.duration, speakers: shaped.speakers, segments: shaped.segments, transcript: shaped.transcript
      }, null, 2));
      fs.writeFileSync(txtPath, transcriptTxtBody(shaped));

      invalidateCaches();
      return res.json({
        success: true,
        data: {
          success: true, speakers: shaped.speakers, segments: shaped.segments.length, duration: shaped.duration,
          transcriptJsonUrl: encodeURI(`/storage/cache_deepgram_transcripts/DEEPGRAM_TRANS_${baseId}.json`),
          transcriptTxtUrl: encodeURI(`/storage/cache_deepgram_transcripts/DEEPGRAM_TRANS_${baseId}.txt`)
        }
      });
    } catch (err) {
      console.error('[VideoProcessingController] generateTranscript error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /** Upload an MP4 video to storage/screen-recordings.
   *  The raw binary body is streamed straight to disk (no full-file memory
   *  buffering); the encoded filename travels in the X-File-Name header.
   */
  async uploadVideo(req, res) {
    try {
      // Filename is sent URL-encoded (so names with spaces/special chars work).
      let fileName = null;
      const rawName = req.headers['x-file-name'] || '';
      try { fileName = safeVideoName(decodeURIComponent(String(rawName))); }
      catch (e) { fileName = safeVideoName(String(rawName)); }
      if (!fileName) {
        return res.status(400).json({ success: false, error: 'Invalid or unsafe video filename. Only .mp4 files are allowed.' });
      }
      if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

      const destPath = path.join(RECORDINGS_DIR, fileName);
      if (fs.existsSync(destPath)) {
        // Drains the incoming body so the connection can be reused, then reports the conflict.
        req.on('data', () => {});
        await new Promise(resolve => req.on('end', resolve));
        return res.status(409).json({ success: false, error: `A video named "${fileName}" already exists in storage/screen-recordings. Rename the file or choose another.` });
      }

      // Stream the request body to disk in bounded chunks, cleaning up the
      // partial file if anything fails mid-upload.
      const FLUSH_THRESHOLD = 4 * 1024 * 1024; // flush every ~4 MB
      let totalBytes = 0;
      let pending = Buffer.alloc(0);
      let writeError = null;
      const flush = () => {
        if (pending.length) {
          fs.appendFileSync(destPath, pending);
          pending = Buffer.alloc(0);
        }
      };
      const cleanup = () => { try { fs.unlinkSync(destPath); } catch (e) { /* already gone */ } };

      req.on('data', (chunk) => {
        if (writeError) return;
        totalBytes += chunk.length;
        pending = Buffer.concat([pending, chunk]);
        if (pending.length >= FLUSH_THRESHOLD) {
          try { flush(); }
          catch (err) { writeError = err; cleanup(); }
        }
      });
      req.on('error', () => { writeError = new Error('upload stream aborted'); cleanup(); });
      await new Promise(resolve => req.on('end', resolve));

      if (writeError) {
        cleanup();
        return res.status(500).json({ success: false, error: 'Upload failed: ' + (writeError.message || 'write error') });
      }
      try { flush(); }
      catch (err) { cleanup(); return res.status(500).json({ success: false, error: 'Upload failed: ' + (err.message || 'write error') }); }
      if (totalBytes === 0) {
        cleanup();
        return res.status(400).json({ success: false, error: 'Uploaded file is empty.' });
      }

      const sizeMB = (totalBytes / (1024 * 1024)).toFixed(2);
      console.log(`[VideoProcessingController] uploaded ${fileName} (${sizeMB} MB)`);
      invalidateCaches();
      return res.json({
        success: true,
        data: { fileName, size: sizeMB, videoPath: videoLink(fileName) }
      });
    } catch (err) {
      console.error('[VideoProcessingController] uploadVideo error:', err);
      return res.status(500).json({ success: false, error: 'Upload failed: ' + (err.message || 'unknown error') });
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