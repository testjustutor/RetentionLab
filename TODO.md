## Task: Store meeting_assets path columns as base-relative storage paths

- [x] Extended `utils/storagePaths.js` FOLDERS with `summary` -> `storage/summaries` and `video` -> `storage/screen-recordings` (audio/transcript already existed).
- [x] `meetingAssetModel.initializeAssets()` now normalizes `audio_path` (recordings) and `transcript_path` (transcripts).
- [x] `meetingAssetModel.updateAssets()` now normalizes `audio_path`, `transcript_path`, `summary_path`, `video_path` via a per-column kind map.
- [x] `VideoProcessingModel.insertMeetingAsset()` now normalizes `audio_path` (mp3), `transcript_path`, `video_path` (screen-recordings).
- [x] Format matches the existing seeder `09_seed_meeting_assets.js` (`storage/recordings`, `storage/transcripts`, `storage/summaries`, `storage/screen-recordings`), and `toUrl()`/`/storage` static serving handle it.
- [x] Verified: node --check clean on storagePaths.js, meetingAssetModel.js, VideoProcessingModel.js, socraticbot.js.

## Task: Fix MODULE_NOT_FOUND './utils/storagePaths' on server boot

- [x] `socraticbot.js` (in `services/`) had a wrong relative require `./utils/storagePaths`; it must be `../utils/storagePaths`. Fixed.
- [x] Audit other helper importers: `sessionQualityGenerator` (`../`), `transcriptModel` (`../../`), `meetingSessionModel` (`../../../`), `VideoProcessingModel` (`../../../`) — all correct.
- [x] Verified: `node --check` clean and all 5 importer modules load successfully via require.

## Task: Fix FK error on meeting_assets insert (meeting_assets.meeting_id must be internal meetings.id)

- [x] Diagnosed: `meeting_assets.meeting_id` FK → `meetings.id` (INT, migration 031). `socraticbot.js:398` called `MeetingAssetController.initializeAssets(this.meetingId, ...)` with the EXTERNAL id (`jpd-zkvh-tjg`), so the insert failed with ER_NO_REFERENCED_ROW_2.
- [x] Fixed: `socraticbot.js` now passes `this.meetingDbId` (the internal `meetings.id`) to `initializeAssets`.
- [x] Audited other meeting_assets writers: `pythonBridge.js` resolves internal id via `getMeetingIdBySessionId`; `VideoProcessingModel.insertMeetingAsset` (videoProcessing seed path) already passes internal `meetings.id` via `resolveOrCreateSession`/`resolveVideoIds`. No other external-id leaks.
- [x] Verified: node --check clean on socraticbot.js, pythonBridge.js, meetingAssetModel.js.

## Task: Store meeting_sessions transcript/audio as base-relative storage paths

- [x] Audited writers: `TranscriptModel.saveTranscriptFile`/`saveAudioFile` stored bare names (or absolute audio path via `updateAudioPath`), `VideoProcessingModel.updateSessionFileNames` stored bare names — so columns held mixed formats (transcript=bare, audio=absolute)。
- [x] Added `utils/storagePaths.js` with `normalizeStorageRef(kind, input)` (absolute/bare/relative → `storage/recordings/` or `storage/transcripts/<basename>`) and `resolveStoragePath(baseDir, ref, kind)`（joins onto the storage ROOT without double folder。
- [x] Writers now store base-relative refs: `TranscriptModel.saveTranscriptFile`+`saveAudioFile`, `MeetingSessionModel.updateAudioPath`, `VideoProcessingModel.updateSessionFileNames`。
- [x] Readers updated to resolve against the storage ROOT via `resolveStoragePath(path.resolve(__dirname,'..'), ...)` in `services/sessionQualityGenerator.js` and `services/socraticbot.js`。
- [x] Verified: `node --check` clean on the new helper + all 5 touched files.

## Task: Fix FK error on /api/bot/start-bot (meeting_sessions.meeting_id must be internal meetings.id)

- [x] Diagnosed: `meeting_sessions.meeting_id` FK → `meetings.id` (INT PK, migration 029). Both botManager paths called `createSession(meetingId)` with the EXTERNAL string (`sku-qvqr-qts`), so the FK failed when no meetings row had `id` = that external id.
- [x] `meetingSessionModel.createSession`/`meetingAssetModel.getMeetingIdBySessionId` already treat `meeting_sessions.meeting_id` as the internal meetings.id — so the fix is to pass the internal id into `createSession`.
- [x] Added `MeetingAssetModel.ensureMeetingByExternalId(externalId, extra)`: resolves the internal `meetings.id`, or CREATES the meetings row (status='queued', platform/title) if absent, returning the internal id. Guarantees a valid FK target exists。
- [x] `botManager.launchFromDb()`: `createSession(meetingDbId)` (was external meetingId)。
- [x] `botManager.startBot()`: now resolves+guarantees `meetingDbId` via `ensureMeetingByExternalId(meetingId,...)` and calls `createSession(meetingDbId)` (was external meetingId)。
- [x] Verified: node --check clean on botManager.js, meetingAssetModel.js, socraticbot.js; both createSession calls now use meetingDbId.

## Task: Carry both meetings.id,and meetings.external_meeting_id into the bot
- [x] Traced source: `socraticbot.js` `this.meetingId = config.meetingId` is set from `botManager.launchFromDb()`, which reads only `meetingRecord.external_meeting_id` (botManager.js:119). The DB row from `getQueuedMeetings()` (SELECT *) already contains `meetings.id`, but it was unused.
- [x] Where written: `models/meetings/MeetingModel.js` — `getMeetingByIdOrCreate()` insert (line 79/81) writes `meetingData.meetingId` into `external_meeting_id`; `createMeetingFromCalendar` (line 422) writes a generated `cal_...` id; seeder 06 + VideoProcessingModel write it too. `meetings.id` is the auto-increment PK, already returned as `id`/`lastID` at insert.
- [x] `botManager.launchFromDb()` now also reads `const meetingDbId = meetingRecord.id ?? null;` and passes `meetingDbId` into SocraticBot config + instance config + log line.
- [x] `socraticbot.js` stores both: `this.meetingId = config.meetingId` (external) and new `this.meetingDbId = config.meetingDbId ?? null` (internal PK).
- [x] `botManager.startBot()` (immediate path)now ALSO resolves+guarantees `meetingDbId` via `MeetingAssetModel.ensureMeetingByExternalId(meetingId)` (creating a meetings row if absent then, non-fatal)and passes it into SocraticBot config + instance config, so BOTH launch paths carry the internal id — no null caveat remains there (see FK task below for the full FK-safe wiring。
- [x] Verified: node --check clean on botManager.js and socraticbot.js.

## Task: Teams bot stuck on "We can't find this meeting / Type a meeting passcode" — Tab-to-find + type passcode

- [x] Root cause: `handlePasscodeModal` used a single hard-coded selector `input[data-tid="meeting-passcode-input"]` (swallowed by `.catch`), mis-detected only "We couldn't find a meeting", and the light-experience `teams.live.com/light-meetings/launch` page can render the prompt in an iframe that the top-frame lobby-wait text check missed — so the bot never filled/typed anything and stayed stuck.
- [x] Rewrote `handlePasscodeModal()` to (a) detect the passcode/can't-find screen across ALL frames, (b) resolve passcode from config or URL `?p=/?passcode=/?pwd=`, (c) locate the field via selectors first, then real Tab navigation logging every focused element, (d) type via `execCommand('insertText')` (React-reliable) + native-setter fallback, (e) submit via Rejoin/Join/check/continue button or Enter.
- [x] Added `readPasscodeScreen()` (frame-aware detection + captured text for logs), `findPasscodeField()` (selector → Tab discovery across main+child frames), `typeIntoPasscode()`.
- [x] `waitForJoinConfirmation` loop now also checks `readPasscodeScreen()` across frames (`needsPasscode || passcodeState.isPasscodeScreen`) so an iframe-rendered prompt triggers recovery.
- [x] Broadened detection strings to "We can't find this meeting", "We couldn't find a meeting", "meeting might have ended", "Type/Enter a meeting passcode", "rejoin call".
- [x] Verified: node --check passes; helpers present; old method removed; UTF-8/CRLF preserved.

## Task: Fix Teams participantTracker calling undefined _autoRecoverParticipant

- [x] Confirmed: `services/platforms/teams/participantTracker.js` called `this._autoRecoverParticipant()` but never defined it — every leave for an untracked participant threw, was swallowed, and returned `{success:false,'Auto recovery failed'}`, so Teams attendance auto-recovery was silently non-functional.
- [x] Ported Google Meet's inline auto-recovery into Teams as `_autoRecoverParticipant()` (uses Teams' `_key`/`_buildTrackedRecord` conventions; creates the participant record via `recordParticipantJoin` so the leave can be recorded).
- [x] Added `leaveResult.success === false` guard in `handleParticipantLeave` for all three trackers (Teams, Google Meet, Zoom) so they no longer report a successful leave when the model persisted nothing (e.g. row deleted out from under it).
- [x] Minor check: confirmed `database/db.js` DOES implement `db.prepare()`/`stmt.run()`/`stmt.finalize()` for the MySQL shim, so ParticipantModel's sqlite3-style API is safe (no hard crash) — no change needed.
- [x] Verified: node --check passes on all three tracker files; em-dash encoding preserved (UTF-8/CRLF safe edit).

## Task: Fix SQLite syntax in ParticipantModel.recordParticipantJoin

- [x] Audit: `recordParticipantJoin` used `INSERT OR IGNORE` (SQLite-only) while `ensureAttendanceSession` already used MySQL-correct `INSERT IGNORE` — inconsistent and a MySQL syntax error.
- [x] Fix: changed `INSERT OR IGNORE` → `INSERT IGNORE` (line 24), matching the existing MySQL idiom at line 94.
- [x] Verified: only 1 occurrence of `OR IGNORE` in the file, both INSERT statements now consistent, node --check passes.

## Task: Teams bot stuck on "We can't find this meeting / Type a meeting passcode"

- [x] Diagnose: screen text is "We can't find this meeting" but detector only matched "We couldn't find a meeting"; hard-coded passcode selector was silently swallowed (`.catch(()=>{})`) and still returned `true`.
- [x] Fix detection to match all real screen variants (can't/couldn't find, "meeting might have ended", "Type a meeting passcode").
- [x] Add robust passcode-field discovery: multiple selectors FIRST, then real Tab+Enter keyboard navigation inspecting the focused element; log what is displayed.
- [x] Type passcode reliably (DOM setter + input/change events + focus) and submit via Join/Rejoin button or Enter.
- [x] Return `false` + clear warning when no passcode configured/field not found (no false "recovery success").
- [x] Verify: node --check clean on teamsJoiner.js.

## Task: Fix 500 on POST /api/admin/evaluation/rubrics/admin/2/copy-from-master

- [ ] Diagnose root cause (error logs + live DB schema inspection)
- [ ] Fix frontend field mismatch in public/js/admin/evaluation/rubrics.js (API returns id/category_code, page read non-existent category_id)
- [ ] Harden copyFromMaster controller: validate selected category IDs → clear 400 instead of raw 500
- [ ] Verify end-to-end (corrected payload succeeds against live DB; broken payload returns clear 400) + cleanup test rows


## Task: Fix /admin/meetings/calendar authentication

- [x] Audited page route, API routes, middleware/auth, and calendar controller for /admin/meetings/calendar.
- [x] Verified live: page redirects to login when unauthenticated; API returns 401 with no token.
- [x] Confirmed bypass: requireAuth trusted spoofable x-user-id/x-user-role/x-user-company headers (live 200 with real data).
- [x] Confirmed admin calendar API endpoints were not role-gated (only requireAuth).
- [x] Fix 1: middleware/auth.js — gate the header-pass-through behind explicit ENABLE_HEADER_AUTH=true (off by default).
- [x] Fix 2: routes/meetings-calendar.js — add requireRole('admin','super_admin') to all admin calendar endpoints.
- [x] Document ENABLE_HEADER_AUTH in .env.example.
- [x] Re-verify live: spoofed request now 401; no-token still 401; page still redirects.

## Task: Full end-to-end audit + fixes of calendar integration (follow-up)

Audited and live-tested: DB tables, models, controllers, routes, page html/js, meeting sync, and email sending.

- [x] Tested sending verification/AI email via SMTP (Gmail) — delivered (250 OK) and logged in email_logs as 'sent'.
- [x] Path A (admin page Sync button + background global sync → getMeetingByIdOrCreate) verified: inserts meetings with valid columns.
- [x] Found + reproduced: Path B (instructor-calendar/sync via syncGoogleCalendar) is broken — references non-existent columns `meeting_id` and `owner_user_id` in the meetings table.
- [x] Found data issues in calendar_connections: 2 orphan rows (user_id NULL, have tokens), and 1 row (user 6, provider google-meet) marked verified/connected but with NO tokens (cannot sync).
- [x] Fix Path B MeetingModel methods (findMeetingByTitleAndTime / updateMeetingFromCalendar / createMeetingFromCalendar) to match real meetings schema (id / calendar_account / created_by).
- [x] Update callers (meetingsController.syncMeetingFromCalendar, calendarSyncService.syncGoogleCalendar) accordingly.
- [x] Clean up orphan calendar_connections rows (user_id NULL).
- [x] Reset token-less 'verified' connection (user 6) to disconnected/pending so the user can re-authorize.
- [x] Re-verify sync path and list-meetings after fixes.

## Task: Fix "Unknown column 'deleted_by'" on user/instructor soft-delete

- [x] Reproduced cause: users table has no `deleted_by` column, but UsersModel.softDeleteUser (admin + super_admin copies) ran `UPDATE users SET ... deleted_by = ?`, throwing the 500 error when deleting/adding an instructor.
- [x] Fix: write the acting user id into the existing `updated_by` column instead of the nonexistent `deleted_by` (matches users schema; only departments tables have deleted_by).
- [x] Verified: the exact soft-delete SQL now runs (no unknown-column error); users table confirmed to have updated_by and no deleted_by.
- [x] Restarted server; /login returns 200.

## Task: Fix Google OAuth redirect_uri_mismatch on instructor calendar connect

- [x] Diagnosed: instructor email verify link hit /verify; controller built the OAuth callback redirect_uri from the live request Host header → http://www.localretentionlab.com/api/instructor-calendar/callback, but the Google OAuth client (365220553177-…) only had http://localhost:3000/* registered → Google Error 400 redirect_uri_mismatch.
- [x] Made the callback base deterministic: added resolveCallbackBase(req) using GOOGLE_OAUTH_BASE_URL (fallback to Host), applied in verifyToken and handleCallback.
- [x] .env: set GOOGLE_OAUTH_BASE_URL=http://www.localretentionlab.com and merged GOOGLE_REDIRECT_URIS to include both localhost and www.localretentionlab.com endpoints.
- [x] Verified: generated auth URL redirect_uri now = http://www.localretentionlab.com/api/instructor-calendar/callback (independent of request host).
- [x] Restarted server; boot clean.
- [ ] APP ACTION REQUIRED (user): register http://www.localretentionlab.com/api/instructor-calendar/callback and http://www.localretentionlab.com/api/calendar/callback as Authorized redirect URIs in Google Cloud Console for OAuth client 36522050-… . This cannot be done from code.
- [x] REVISED: Google Cloud console already has http://localretentionlab.com/api/instructor-calendar/callback (no www) registered. Aligned app: GOOGLE_OAUTH_BASE_URL=http://localretentionlab.com; merged GOOGLE_REDIRECT_URIS includes localhost + localretentionlab.com endpoints.
- [x] Verified generated auth redirect_uri = http://localretentionlab.com/api/instructor-calendar/callback (matches console). Server restarted with updated env (PID 26284).
- [x] Re-verified calendar authentication: page → /login; API no-token → 401; API spoofed headers → 401.

## Task: Fix "Connected" showing for rows with no OAuth tokens

- [x] Root cause: page shows "Connected" when listConnections maps connection_status='active' (ignores tokens). New rows inserted by CalendarVerificationModel.create defaulted connection_status='active' even with no tokens (row id 5, user test.justtutors@gmail.com was active/verified with no access_token).
- [x] Fix backend: listConnections (admin + instructor branches) now defines "Connected" as connection_status='active' AND access_token present; otherwise 'disconnected' (shows "Connect").
- [x] Fix create: CalendarVerificationModel.create insert now sets connection_status='pending' (was defaulting to 'active').
- [x] Corrected leftover DB row id 5 -> connection_status='disconnected', verification_status='pending'.
- [x] Verified listConnections returns 'disconnected' for all tokenless instructors; server restarted (PID 29524); auth still correct.

## Task: Set Google OAuth flow to http://localhost:3000

- [x] GOOGLE_OAUTH_BASE_URL set to http://localhost:3000 (single active line). GOOGLE_REDIRECT_URIS includes http://localhost:3000/api/instructor-calendar/callback.
- [x] Verified generated auth redirect_uri = http://localhost:3000/api/instructor-calendar/callback (HTTP allowed by Google for loopback, and registered in console).
- [x] Server restarted (PID 11304); boots clean.

## Task: Fix Live Meetings page not showing an ongoing meeting

- [x] Reproduced: meeting id 7 "test" is in_progress (08:45Z–09:45Z, now ~09:01Z), account active with tokens, but getLiveMeetingsByAccounts excluded it.
- [x] Root cause: convertToUTC double-applied the offset. Stored ISO-8601 UTC values (with 'Z' suffix) were re-interpreted as naive Asia/Kolkata wall-clock and shifted 5h30 early, making the meeting look already ended.
- [x] Fixed convertToUTC: ISO strings with an explicit offset (Z/±HH:MM) are used as-is (absolute); only naive "YYYY-MM-DD HH:MM:SS" strings get the manual timezone conversion.
- [x] Verified: same meeting now returns as LIVE; naive string path still converts correctly; syntax OK; server restarted.

## Task: Remove pyannote dependency from transcription engine (use AssemblyAI/WhisperX)

- [x] Reproduced: services/engine/engine_main.py crashed with `ModuleNotFoundError: No module named 'pyannote'` because diarization_engine.py did a hard `from .pyannote_diarizer import PyannoteDiarizer` at import time.
- [x] Removed the hard import. DiarizationEngine now tries, in order: (1) services/assemblyai_engine diarization, (2) pyannote lazily (only if installed), (3) per-segment fallback. A missing pyannote no longer crashes the engine.
- [x] Added _try_assemblyai / _try_pyannote / _context_language helpers.
- [x] Verified: module + whole transcription_task chain import without pyannote; assemblyai pkg (1.0.0) installed & app key present; process() smoke test runs cleanly (falls back, no crash).
﻿# TODO

## Task: Fix transcription + diarization quality to match Teams VTT captions

Context: faster-whisper + Resemblyzer diarization collapsed both 1:1 speakers into SPEAKER_00 and produced more hallucinations than Teams VTT captions for the same session.

- [x] STEP 1 - Force speaker count: pipeline.run_pipeline defaults n_speakers=2; resemblyzer_diarizer strictly uses min(max(n,1),len(feats)) clusters + logs forcing num_speakers=N.
- [x] STEP 2 - Word-level alignment via WhisperX: new services/python_engine/whisperx_engine.py (whisper transcribe -> word align -> pyannote diarization with min/max_speakers=2 -> per-word speaker assignment, majority vote per segment). Installed whisperx. Pipeline prefers this path; falls back to faster-whisper+Resemblyzer when unavailable (PYTHON_ENGINE_USE_WHISPERX=0 to disable).
- [x] STEP 3 - Model upgrade + domain context: WhisperX default model large-v3 (PYTHON_ENGINE_MODEL_WHISPERX); initial_prompt per subject via SUBJECT_PROMPTS map (PYTHON_ENGINE_SUBJECT=math/science/english) with math prompt matching our content. Added keys to .env and .env.example.
- [x] STEP 4 - Audio preprocessing: new audio_preprocess.py - ffmpeg loudnorm volume normalization + noisereduce spectral denoise; writes prep/denoised wav, original untouched; wired as first pipeline step.
- [x] STEP 5 - Per-participant channels: ffprobe channel detection + split_stereo_channels(); when stereo L/R available each channel is transcribed independently (channel_transcriber.py) and merged by timestamp - diarization skipped entirely for these recordings.
- [x] STEP 6 - Diarization health check: new health_check.py computes per-speaker duration share; if one label >90% => unhealthy with reason; controller marks video_processing.status=needs_reprocessing (new model method markNeedsReprocessing) and returns needsReprocessing in the API response.
- [x] STEP 7 - Validation script: scripts/validate_transcription.py <audio.mp3> <captions.vtt> - parses Teams VTT, runs updated pipeline, reports % speaker-label match + WER vs VTT text (jiwer installed).
- [x] All python_engine files compile; controller passes node --check.

## Task: Lock in confirmed session facts + speed optimizations

Confirmed by user: ALL videos are 1:1 tutor-student, exactly 2 speakers, language is English, tutor teaches student. No VTT files exist for other recordings (validation script remains for reference only).

- [x] Language forced to English in all paths (pipeline default + whisper_engine + whisperx_engine) - skips auto-detection for speed and accuracy.
- [x] Role labels: speakers renamed to Tutor / Student instead of SPEAKER_00/01. Tutor = most total talk time (they teach); other = Student. Applied in whisperx path and fallback Resemblyzer path; channel path labels channel 1 = Tutor.
- [x] Speed/quality: condition_on_previous_text=False on all whisper backends (fewer hallucination cascades, faster), initial_prompt domain context also added to faster-whisper fallback path.
- [x] Verified: role labeling maps most-talk-time speaker to Tutor correctly; all python files compile; pipeline imports OK.

## Task: Move video_processing ALTERs into migration 060

- [x] database/migrations/060_create_video_processing_table.js: file_user_id / file_meeting_id / file_session_id now declared directly inside CREATE TABLE (no ALTER).
- [x] models/super_admin/settings/VideoProcessingModel.js: removed ensureColumns() and all runtime ALTER TABLE logic; ensureTable() CREATE TABLE IF NOT EXISTS now mirrors the full migration schema.
- [x] Verified: model + migration pass node --check; live table has all 21 columns incl. file_* ids so existing inserts keep working; zero ensureColumns/ALTER references left in app code.

## Task: Move remaining ALTER-only migrations into base table definitions

- [x] Confirmed 025_create_system_settings_table.js already declares is_editable TINYINT(1) DEFAULT 1 directly in CREATE TABLE.
- [x] Confirmed 010_create_rubric_indicators_table.js already declares benchmark TEXT + requires_video TINYINT(1) directly in CREATE TABLE.
- [x] Deleted 026_add_is_editable_to_system_settings.js and 063_add_benchmark_requires_video_to_rubric_indicators.js (ALTER-only, redundant - effects baked into base CREATE TABLE migrations).
- [x] Verified migration runner (database/reset-db.js) discovers files via readdirSync - no tracking table, so file removal is safe.
- [x] Verified zero references to the deleted files; all 62 remaining migrations pass node --check; zero ALTER TABLE statements remain in the migrations folder.

## Task: AssemblyAI — opt-in backend for python_engine

- [x] Create services/python_engine/assemblyai_engine.py mirroring WhisperXEngine: transcribe_and_diarize(audio_path) -> {language, segments, words, backend, num_speakers_forced}.
- [x] Wire opt-in AssemblyAI branch (first) into pipeline.py via PYTHON_ENGINE_USE_ASSEMBLYAI / config.use_assemblyai (default OFF -> no behaviour change).
- [x] Skip _align_diarization for assemblyai and channels backends (midpoint/gap collision bug).
- [x] Add `assemblyai` to requirements.txt and ASSEMBLYAI_API_KEY / PYTHON_ENGINE_USE_ASSEMBLYAI to .env.
- [x] Verify: AST syntax check on all touched files; lazy-import resilience (assemblyai not installed -> graceful fallback to WhisperX); pipeline fall-back behaviour unchanged.
- [x] ENABLED: PYTHON_ENGINE_USE_ASSEMBLYAI=1 in .env; fixed IndentationError at assemblyai_engine.py line 64; removed duplicate empty ASSEMBLYAI_API_KEY= that could shadow the real key; engine now load_dotenv()s root .env itself (python_deepgram pattern). Live-verified against storage/recordings/1064_Neeraj Tanwar_Regular_247412_General Discussion-20260817_092941.mp3 -> 94 segments / 1089 words / 2 speakers / backend=assemblyai.

## Task: Step-level START/FINISH logging in python_engine pipeline

- [x] Added _step() helper to services/python_engine/pipeline.py: prints ONE simple "[STEP] <name> : STARTED/COMPLETED/FAILED (detail)" line to stdout per stage (echoed by runner.js on its own line - bar is closed first, so nothing glues onto the percentage line) + writes to the log file.
- [x] Instrumented every stage: audio preprocessing, AssemblyAI transcription, channel transcription, WhisperX transcription, Whisper fallback, speaker diarization, diarization health check, AI audit, observation report, save results.
- [x] Verified: py_compile OK; live _step/_emit_progress output shows each step on its own line between progress updates.

## Task: Stuck-vs-working visibility (step timing + heartbeat + Node timeout)

- [x] Step timing: every [STEP] COMPLETED/FAILED line now includes how long the step took, e.g. "[STEP] AI audit : COMPLETED (took 37s) (oqi=78.5)".
- [x] Liveness heartbeat: daemon thread in pipeline.py refreshes the progress bar every 20s during a step as "PROGRESS <pct> <stage> | still working: '<step>' for Ns (total Ms)" -> if the bar line FREEZES, the process is truly stuck. Daemon dies with the process.
- [x] Hard timeout: videoProcessingController now passes PYTHON_ENGINE_TIMEOUT_MS (default 45 min) to runPythonEngine so a hung Python engine fails cleanly (record marked failed, error toast) instead of waiting forever.
- [x] Verified: py_compile OK; node --check OK; live test shows heartbeat lines at 2s/4s while a step runs and "took Ns" on completion/failure.

## Task: Replace in-place progress bar with plain text lines

- [x] runner.js no longer renders the single-line \r progress bar; every PROGRESS update (including heartbeat "still working" lines) is echoed as its own plain [python_engine] line. Identical consecutive PROGRESS updates are deduped.
- [x] BUGFIX: the JSON-payload filter skipped any line starting with "[" which also swallowed "[STEP] ..." log lines - now only suppresses real JSON payloads ({...} or [{/"...).
- [x] Verified: node --check OK; simulation shows PROGRESS/heartbeat/STEP lines each on their own line, JSON object+array payloads suppressed, duplicate progress lines skipped.

## Task: Fix pipeline hang at "Running AI audit"

- [x] ROOT CAUSE: AI_PROVIDER=gemini -> ai_client._ask_gemini calls client.models.generate_content() with NO timeout; the google-genai SDK can hang forever on network/API issues, stalling the pipeline at "[STEP] AI audit : STARTED".
- [x] FIX: AiClient.ask_ai now runs every provider call under a watchdog thread - raises "AI Provider timeout" after AI_CALL_TIMEOUT seconds (default 180, override via .env) so the audit step FAILS cleanly and the pipeline continues to report/save instead of hanging. Added AI_CALL_TIMEOUT to .env.example.
- [x] Verified: py_compile OK; simulated 60s-hanging provider call -> RuntimeError fired at exactly 3s (test env); normal fast calls unaffected.

## Task: Failure logging everywhere (no silent failures)

- [x] Save results step: wrapped in try/except - on write failure logs "failed to save results file" + [STEP] Save results : FAILED, pipeline continues (transcript still returned in JSON).
- [x] main.py top-level catch now logs "FATAL pipeline crashed" with exception type + traceback to the log file before returning the error JSON.
- [x] storage_output.py: replaced silent print with proper log_with_type ERROR entry.
- [x] Verified: py_compile OK; live test shows FileNotFoundError logged as ERROR | [PYTHON_ENGINE] when output path is bad; FATAL log present in main.py.

## Task: No raw print() - always the logger

- [x] utils/logger_util.py console StreamHandler now writes to STDOUT so every log line is relayed by the Node runner to the terminal.
- [x] pipeline.py: _emit_progress -> "[PROGRESS] 40% - <stage>" via log_with_type INFO; heartbeat -> "[HEARTBEAT] still working: '<step>' for Ns (total Ms)" via log_with_type WARNING; _step no longer prints - logger only.
- [x] Only remaining stdout writes are the JSON data contracts (python_engine/main.py final result, video_convert.py CLI output) - marked with "DATA CHANNEL" comments; these are machine-readable payloads for Node, not logs.
- [x] Verified: py_compile OK; live run emits timestamped INFO/WARNING logger lines for progress/steps/heartbeat on stdout (relayed by runner.js); zero stray prints left in services/python_engine.

## Task: Fix "python_engine returned invalid JSON" after logger-to-stdout change

- [x] ROOT CAUSE: runner.js extracted the result via first-'{'..last-'}' slice of stdout. After logs moved to stdout, log lines containing braces (e.g. health check "speakers=[{'speaker': ...}])") poisoned the slice -> invalid JSON.
- [x] FIX: runner.js close handler now scans complete stdout lines BACKWARDS and takes the first line that parses as a JSON object (the result is always printed last as one single-line JSON). Clean rejects with stderr excerpt when no result found.
- [x] Verified: node --check OK; 4-case test passes (braces-in-log-lines, last-JSON-wins, no-JSON+nonzero-exit reject, JSON-before-trailing-log-line).

## Task: Add plain audio-only transcript file (<base>.transcript.txt)

- [x] storage_output.py: new save_plain_transcript(result, output_dir=None) - writes result["plain_text"] EXACTLY as-is (no headers/speakers/timestamps) to <base>.transcript.txt in the same output dir; same defensive pattern as save_diarization_result (never raises, None on failure, log_with_type ERROR on write failure).
- [x] pipeline.py: added "plain_text" (the SAME string already computed for the audit step, not re-derived) to the save payload; calls save_plain_transcript right after save_diarization_result; Save results COMPLETED step now reports both paths.
- [x] run_pipeline result dict now includes "plain_output_path" so Node sees the new file's path.
- [x] Existing .diarization.txt/.diarization.json outputs unchanged - purely additive third file.
- [x] Verified: py_compile OK; live test confirms byte-exact content, all 3 files side by side (.diarization.json/.diarization.txt/.transcript.txt), empty/missing plain_text -> None without error, unwritable dir -> None + ERROR log.

## Task: Validate transcription against Teams VTT (session 247412 audio vs 247410 VTT)

- [x] Same session confirmed: first 15 min of VTT content matches recording word-for-word ("It's still loading", annotation issue, y=x+1 lesson etc.). VTT covers 55.6 min meeting; recording/audio only ~14.9 min -> recording is truncated, transcript is correct for the audio that exists.
- [x] Speaker mapping learned from data: Speaker 1 = Neeraj Tanwar (tutor), Speaker 2 = Abeir (student) - matches talk-time dominance rule.
- [x] Segment-level speaker match vs real names: 65.6% (59/90). Limited by Teams caption lag + AssemblyAI merging adjacent tutor/student turns into one utterance.
- [x] Text match (overlap window, 200 VTT cues): naive WER 62.4% is inflated by incomplete reference (VTT 789 words vs ours 1086 - insertions alone imply ~38% floor). Fair alignment (difflib): 79.6% of ALL words Teams captured also appear in our transcript; our transcript contains ~38% MORE speech than the captions caught (Teams drops quiet/faint speech).
- [x] Quality spot-checks favor ours: "Hello, be."/"Code." in VTT vs "Hello, Abhijit."/"Cold." in ours.
- Note: jiwer not installed in system python; WER computed via Levenshtein fallback. validate_transcription.py remains available for full re-runs.

## Task: Fix proper-name recognition ("Abir" misheard as "Abhijit")

- [x] User spotted: tutor's greeting "Hello, Abir." (student's real name, confirmed by VTT voice tags "Abeir" x274) was transcribed as "Hello, Abhijit." by AssemblyAI / "Hello, be." by Teams.
- [x] FIX: word_boost support - AssemblyAIEngine now accepts word_boost=[names] and passes it to TranscriptionConfig; pipeline reads it from aiSettings.word_boost or PYTHON_ENGINE_WORD_BOOST env (comma separated).
- [x] .env: PYTHON_ENGINE_WORD_BOOST=Abir,Abeir,Neeraj Tanwar; .env.example documents the key.
- [x] Verified: py_compile OK; local test shows boost names reach TranscriptionConfig correctly; no-boost path unchanged (None).

## Task: Make word_boost fully dynamic (NO hardcoded names)

- [x] Removed hardcoded 'Abir','Abeir','Neeraj Tanwar' from .env (PYTHON_ENGINE_WORD_BOOST now empty, documented as optional global fallback only).
- [x] videoProcessingController.processAudio builds word_boost DYNAMICALLY per session: tutor name from THIS recording's filename (parseNamedVideoName firstName/lastName) + student_name from session_metadata via SessionMetadataModel.getByMeeting(meetingId); passed as aiSettings.word_boost.
- [x] Flow: controller aiSettings.word_boost -> runner argv -> pipeline config.get('word_boost') -> AssemblyAIEngine word_boost -> TranscriptionConfig. Env var only a fallback; scales to millions of sessions with zero code/config changes per session.
- [x] Verified: node --check OK; parse_ai_config test shows aiSettings.word_boost reaches pipeline config; no-boost path unchanged.

## Task: Centralize Whisper model config (services/python_engine)

- [x] Mapped every model definition point: controller PYTHON_ENGINE_MODEL (--model argv) -> main.py CLI default -> run_pipeline signature default -> per-backend envs (PYTHON_ENGINE_MODEL_WHISPERX / PYTHON_ENGINE_MODEL_CHANNELS) -> hardcoded last-resort defaults.
- [x] KEY INSIGHT documented in .env: with AssemblyAI enabled NO Whisper model is loaded; these keys only affect fallback backends. AssemblyAI always runs its best model server-side.
- [x] Heaviest = large-v3 everywhere: PYTHON_ENGINE_MODEL=large-v3 (legacy faster-whisper + controller --model), PYTHON_ENGINE_MODEL_WHISPERX=large-v3 (already), channel-split branch now env-or-config-or "large-v3" (was hardcoded small), run_pipeline default base->large-v3.
- [x] Precedence flipped so the dedicated env var wins - a caller can no longer silently downgrade quality (WhisperX branch previously let controller's 'tiny' override large-v3; also removed duplicated wx_model/subject lines).
- [x] .env comments warn about cost: ~3GB download per backend on first run, 6-10GB RAM/VRAM, VERY slow on CPU-only machines (drop to medium/small there).
- [x] Verified: py_compile OK; live env read shows all three model keys resolve to large-v3.

- [x] AssemblyAI pinned to its HEAVIEST tier: AssemblyAIEngine now sets speech_model="best" (highest accuracy) on every TranscriptionConfig; overridable via PYTHON_ENGINE_ASSEMBLYAI_SPEECH_MODEL ("nano" for cost-sensitive setups, "default" skips pinning). Added key to .env and .env.example. Submit log shows speech_model=best.
- [x] Verified: py_compile OK; live test shows env->engine->TranscriptionConfig all resolve to speech_model=best.

### Notes / assumptions
- `assemblyai` is OPTIONAL: lazy-imported inside __init__, so a missing package or key is caught by the pipeline try/except and falls back to WhisperX (no behaviour change by default).
- Segments carry {start, end, text, speaker} and words {word, start, end, speaker} (ms -> s), matching WhisperXEngine output shape so downstream audit/storage/health-check work unchanged.
- FIXED log spam: runner.js processed stdout per data-chunk, so the huge single-line result JSON arriving split across pipe chunks leaked its middle fragments to the terminal as [python_engine] dumps. Now partial lines are buffered across chunks; only complete non-JSON lines are echoed (200-char truncated). Verified: 2000-word payload in ugly 997-char chunks -> zero fragments echoed, stdout still fully captured for parsing.

## Task: Verify video-processing page matches video_processing table schema

- [x] FIXED BUG: makeTrackRec returned snake_case keys (user_id/file_user_id/...) while VideoProcessingModel.saveProcessingRecord reads camelCase (userId/fileUserId/...) -> all tracking columns were inserting as NULL. Rewrote makeTrackRec to emit camelCase keys matching the model exactly.
- [x] Model now uses ALL table columns: saveProcessingRecord/updateProcessingRecord also write video_user_id, video_meeting_type, video_meeting_id, video_session_id, meeting_type; getProcessingHistory returns them.
- [x] Controller populates both id families: file-origin (file_user_id/file_meeting_id/file_session_id + legacy video_* duplicates) and resolved DB ids (user_id/meeting_id/session_id); video_meeting_type says which id the filename carried (session|meeting); meeting_type=teams.
- [x] Frontend Report button now keys off reportJsonExists (file on disk) instead of always-truthy reportJsonUrl.
- [x] Live insert test through the model confirmed every column family populates (file_user_id=1064, video_session_id=247410, user_id, meeting_type=teams, names/title); test row deleted.
- [x] node --check clean on model + controller; running server already had latest code; API correctly returns 401 without a super_admin session (auth working).

## Task: Fix ER_BAD_FIELD_ERROR - participants + participant_sessions table mismatch (zoom bot)

- [x] Diagnosed: ParticipantModel/ParticipantsModel used columns (first_joined_at, last_left_at,
      total_duration_seconds, participant_status) that do NOT exist in the participants table
      (which uses join_time/leave_time), causing Unknown column first_joined_at.
- [x] Confirmed the legacy participant_sessions table was removed from the live DB; only
      participant_attendance_sessions (keyed by participant_id) remains.
- [x] Chose a code-only fix (no migration/table changes): reverted the temporary migration-030
      edit and dropped the temporary added columns from the live DB (restored original schema).

## Code changes (all consolidated onto participants + participant_attendance_sessions)

- [x] ParticipantModel.recordParticipantJoin now inserts join_time (not first_joined_at /
      participant_status) and no longer calls the removed MeetingParticipantSessionModel; it
      records attendance via ensureAttendanceSession.
- [x] ensureAttendanceSession now writes session_id (was missing, so INSERT IGNORE silently
      failed the session_id NOT NULL constraint); signature takes sessionId.
- [x] ParticipantModel.recordParticipantLeave uses join_time/leave_time (no non-existent cols)
      and drops the removed MeetingParticipantSessionModel call.
- [x] ParticipantModel.recordParticipantRejoin / recordRejoinLeave no longer reference
      participant_status/total_duration_seconds or MeetingParticipantSessionModel, and the
      rejoin INSERT now includes session_id.
- [x] getMeetingAttendanceSummary derives first_joined_at/last_left_at/total_duration_seconds/
      participant_status from join_time/leave_time + attendance durations (as aliases).
- [x] Removed the unused MeetingParticipantSessionModel require from ParticipantModel.
- [x] ParticipantsModel.create/getByMeeting now use join_time/leave_time.
- [x] Rewrote ParticipantSessionsModel.js and removed MeetingParticipantSessionModel.js (both
      previously hit the deleted participant_sessions); they now operate on
      participant_attendance_sessions (resolving participant by name).
- [x] Reviewer participant counts (ReviewerSessionsModel.js, reviewerSessionsController.js) now
      count from participants instead of the deleted participant_sessions.

## Verification (live MySQL)

- [x] node --check passes on every touched file.
- [x] Live join test: recordParticipantJoin succeeds with join_time set and no column error.
- [x] Live attendance insert persists (session_id, session_number, attendance_status=active).
- [x] Live leave test: recordParticipantLeave succeeds, join_time+leave_time both populated.
- [x] Test rows cleaned up.

## Task: Fix admin meetings/completed page returning no data

- [x] Diagnosed root cause: getCompletedMeetingsByAccounts only matched status=completed (none exist)and JOINed meeting_sessions on the wrong key ms.meeting_id=m.external_meeting_id (meeting_sessions.meeting_id is internal meetings.id), so nothing ever matched.

- [x] Rewrote query to INNER JOIN meeting_assets ma ON ma.meeting_id=m.id (internal key)and require only that an asset row exists (transcript/audio/summary/video not null)- no meeting/session status check, per requirement.

- [x] Added optional from_date/to_date AND target-email IN filters to the query.

- [x] Controller getCompletedMeetings now reads from_date/to_date/instructor_id from req.body (falls back to req.query)and resolves target emails via CalendarUsersModel (instructor uuid or all active connections.

- [x] Frontend completed.js now sends all filters (from_date/to_date/instructor_id/hours)in the POST payload body instead of the URL query string.

- [x] Verified live: query returns 2 meetings with meeting_assets (zoom Meeting, bot test, totalEvents=2) inspite their meetings.status=in_progress, with correct durations.

- [x] node --check passes on MeetingModel.js, meetingScheduleController.js, completed.js.


- [x] Fixed Date & Time not showing on completed page: controller groupByAccount now emits start_time/end_time/start/end (it previously only sent scheduled_start_time/scheduled_end_time, but the JS reads e.start_time via fmtTime(e.start_time), so the cell rendered --.)


- [x] Fixed instructor_id filter on admin meetings/completed: instructor_id is a users.user_uuid; switch lookup from CalendarUsersModel.getUserById (calendar_connections-based) to UsersModel.getUserByUuid (users table direct). Now the email IN filter is applied against the resolved instructor.

## Task: Fix admin content summaries page returning 0

- [x] Diagnosed: admin /api/admin/content/summaries uses VideoRecordingsModel.getAssets(assetType=summary). It scoped meetings by m.created_by=user.id but meetings have created_by=NULL (their instructor relation is via m.calendar_account email), so the admin/instructor filters excluded all rows -> count 0.
- [x] Joins users by LOWER(u.email)=LOWER(m.calendar_account) instead of m.created_by=u.id.
- [x] Admin scope now: calendar_account IN instructor/solo_instructor emails of the admin company.
- [x] Instructor filter now resolves user.email by id and matches calendar_account.
- [x] Fixed duplicate rows: joined meeting_sessions by ms.id=ma.session_id (asset already carries session_id) instead of ms.meeting_id=m.id.
- [x] Kept no status check - only requires ma.summary_path IS NOT NULL.
- [x] Verified (live): returns 3 summaries for meeting_assets with summary_path (zoom Meeting + 2 bot test sessions), admin scoping + instructor filter + date range all work.
- [x] node --check passes on VideoRecordingsModel.js.

- [x] Fixed summary View URL: videoRecordingsController.getSummaries returned the raw storage path (storage\summaries\...\ backslash or C:\... absolute) as summary_url, so the browser treated it as a relative file under public/admin/content/ and requested storage...txt.html -> ENOENT. Added a toUrl() helper that turns relative/absolute/malformed storage paths into /storage/... web URLs, and server.js already serves /storage -> storage/. Verified files exist at the resolved paths.

## Task: copy-from-master only stored categories, not indicators

- [x] Diagnosed: admin_rubric_indicators.admin_category_id is NOT NULL (FK to admin_rubric_categories.id) but assignCategoryToAdmin and createCustomIndicator inserted indicators WITHOUT admin_category_id, so INSERT IGNORE silently dropped every indicator row (MySQL upgrade to warning). Result: categories persisted, indicators = 0.
- [x] assignCategoryToAdmin now resolves the admin category PK (admin_category_id) after creating the admin category (looks it up via master_category_id+admin_user_id) and stamps it on each indicator INSERT.
- [x] createCustomIndicator now resolves admin_category_id (arcRow.id for admin parents; looks up admin category copy for master parents) and includes it in the INSERT for the custom indicator.
- [x] Existing admin 2 data backfilled: category 17 had 0 indicators -> 16; all 8 categories now have 16/12/12/12/12/12/9/9 indicators.
- [x] Verified: assignCategoryToAdmin(1,2,2) returns indicators_copied=16 and DB shows 16 rows for admin_category_id=17; join back to admin_rubric_categories works. node --check clean.
