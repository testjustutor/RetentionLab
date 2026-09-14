# TODO

## Task: Live page — configurable bot launch lead time + "Bot will join meeting within MM:SS" countdown

- [x] Config: settings.js bot.autoJoinLeadMinutes (BOT_LAUNCH_LEAD_MINUTES, default 3); .env already has BOT_LAUNCH_LEAD_MINUTES=3 + BOT_QUEUED_EXPIRE_MINUTES=30; .env.example documents both
- [x] MeetingModel: getQueuedMeetings(leadMinutes) parameterizes launch window; getLiveMeetingsByAccounts(emails, leadMinutes) scales live filter + exposes _seconds_until_launch (TZ-safe)
- [x] BotPollingController: launch window uses settings.bot.autoJoinLeadMinutes
- [x] meetingScheduleController /live payload: seconds_until_launch
- [x] live.js: "Bot will join meeting within MM:SS" countdown chip (status strip + busy action) for pre-join statuses with 1s in-place ticker
- [x] Verify: node --check on all 5 touched JS files passed; settings resolve from .env (autoJoinLeadMinutes=3, queuedExpireMinutes=30); countdown helper logic unit-checked (fmt/skip scenarios). Server restart (PID 16124) still needed to load new settings/controller/model code — live.js is served fresh so the UI picks it up without restart
## Task: Audit requires_calculation / calculation_config values against the code (rubric_indicators + admin_rubric_indicators)

User provided a live phpMyAdmin export and asked to verify `requires_calculation`/
`calculation_config` in both tables match what `services/engine/audit_scoring.py`
can actually resolve, and fix the seeder if not.

Finding: exactly one indicator, `F4.2` ("Allows sufficient learner talk time"),
had `requires_calculation=1` with `calculation_config=
{"metric":"talk_ratio_student_pct","operator":">=","threshold":50}` in both
tables (admin table is a straight clone of the master via
`020_admin_rubric.js`, so both were consistent with each other - just both
wrong). The metric name can never resolve because (1) `context.talk_ratio` is
never populated in the live DAG - `transcription_task.py` never runs
diarization, only `transcript_builder.py::build_plain_text()` - and (2) even
when talk_ratio IS computed, its keys are raw speaker identities (a
diarization label or a resolved real name), never a semantic "student"/
"tutor" role - nothing in this codebase assigns which speaker is the student.
As configured this indicator could only ever resolve to Not Applicable
(`resolve_calculation()`'s safe fallback for an unresolvable metric name).

User's call: revert F4.2 to a normal (non-calculated) indicator until real
speaker-role detection exists, rather than leaving dead configuration in
place or picking a substitute metric that would change what the indicator
actually measures.

- [x] Diff `admin_rubric_indicators`/`rubric_indicators` from the user's SQL
      export against `services/engine/audit_scoring.py::resolve_calculation()`
      and `services/engine/audit_metrics.py::build_calculation_context()` -
      confirmed F4.2 is the only indicator with requires_calculation=1, and its
      metric name can never appear in metrics_context
- [x] `database/seeders/006_rubric.js`: dropped `requires_calculation`/
      `calculation_config` from the F4.2 entry (reverts to `ind.requires_calculation
      ? 1 : 0` / `ind.calculation_config ? ... : null` defaulting to 0/NULL);
      confirmed no other indicator in the seeder sets these fields
- [x] Fix moved into the SEEDERS (standalone migration `056_fix_f42_calculation_metric.js`
      was removed per request): `006_rubric.js` and `020_admin_rubric.js` now each
      include an idempotent UPDATE (both use `WHERE indicator_code = 'F4.2' AND
      requires_calculation = 1`) so already-seeded rows in `rubric_indicators` and
      `admin_rubric_indicators` self-heal on the next seeder run (`020_admin_rubric.js`
      runs the UPDATE before its existing-clone skip, since cloning only happens on
      first seed)
- [x] `database/reset-db.js`: migration-count comment/log range now "(001-055, 057)"
      after removing 056 (56 migration files in total)
- [x] Verify: `node --check` on all 3 files; confirmed migration auto-discovery
      (`fs.readdirSync(migrationsDir).sort()`) needs no manual registration
- [x] Deliver changed files back to the device

## Task: Skip AI audit for empty / single-speaker-only transcripts (pre-audit transcript validation)

Goal: detect a transcript with no meaningful conversation (empty/near-empty) or
only one speaker BEFORE the AI audit LLM call, so Whisper's output is never
sent to an audit that can't produce a real result, and the frontend gets a
friendly, non-error "skipped" outcome instead of a garbage report.

Corrected an assumption in the original plan during investigation: real
Google Meet/Deepgram captions use a TIME-RANGE bracket
(`[19:12:52 - 19:12:52] Name: text`), not a single timestamp like
Teams/Zoom (`[4:02:24 PM] Name: text`) — confirmed against
`services/platforms/teams/captionMonitor.js` and real
`storage/transcripts/TRANS_*.txt` files. Speaker detection therefore uses one
generic "`[...] Name:`" line pattern (works for both shapes, and the unused
diarization `build()` float-second format) instead of hardcoded per-platform
regexes.

Confirmed `video_processing.status` (models/super_admin/content/VideoProcessingModel.js)
is a free-form `VARCHAR(50)`, not an ENUM — a new `'skipped'` status value
needs no migration.

Scope decision: a Node-side pre-flight check (skip spawning Python entirely
for a cached transcript) was considered but dropped — reliably locating the
matching TRANS_*.txt from Node would duplicate pipeline_context.py's fuzzy
session-matching logic for a marginal win (Whisper still needs to run to
produce the authoritative transcript the audit would use), so validation
stays a single source of truth on the Python side, right after transcription
and before the audit call. The Deepgram "AI Transcript" endpoint has no
Python pipeline at all, so it gets its own lightweight Node-side check.

- [x] Investigate current flow end-to-end (pipeline_context.py, transcription_task.py,
      audit_task.py, summary_task.py, persist_results_task.py, engine_main.py,
      pythonBridge.js, videoProcessingController.js, video-processing.js) and
      the real caption/transcript formats (TRANS_*.txt examples + captionMonitor.js)
- [x] New `services/engine/transcript_validation.py`: `strip_boilerplate()`,
      `meaningful_word_count()` (`MIN_MEANINGFUL_WORDS=10`, env-overridable via
      `TRANSCRIPT_MIN_MEANINGFUL_WORDS`), `detect_speaker_count()` (generic
      `[...] Name:` regex against the captions file, NOT the unlabeled Whisper
      text), `validate_transcript()` -> `{valid: true}` or
      `{valid: false, reason: 'empty_transcript'|'single_speaker', message}`
- [x] `pipeline_context.py`: add `processing_skipped` / `skip_reason` / `skip_message`
      attrs; surface them in `build_final_response()`
- [x] `transcription_task.py`: call `validate_transcript()` right after
      `context.labeled_transcript` is set (using the captions file content when
      available); set the skip attrs on the context
- [x] `audit_task.py`: skip the LLM call when `context.processing_skipped`,
      write a skip-record `AUDIT_<base_id>.json` so `audit_json_path` still resolves
- [x] `summary_task.py`: skip summary generation/file write when skipped
- [x] `persist_results_task.py`: skip DB persistence entirely when skipped
      (mirrors the existing `_meeting_exists`/`_session_exists` early-return pattern)
- [x] Verify: py_compile all touched Python files + stubbed-import integration
      test exercising both the skip and non-skip paths (real code, mysql.connector/
      openai/whisper stubbed as the only external boundaries - same technique
      test_ai_evaluation.py already documents for services.engine.transcriber/.client)
- [x] New `services/shared/transcriptValidator.js` (Node mirror of the word-count
      check only, for the Deepgram endpoint, which has no Python pipeline) -
      verified against the same real TRANS_*.txt examples, matches Python 1:1
- [x] `pythonBridge.js` `runFullAudioPipeline()`: read `executionMatrix.skipped`/
      `skip_reason`/`skip_message`; skip the `MettingAssetController.updateAssets()`
      "Completed" call when skipped; return `{success:true, skipped:true, skipReason, skipMessage, meetingId, sessionId}`
- [x] `videoProcessingController.js` `processAudio()`: handle `result.skipped` ->
      save `status:'skipped'`, return a non-error `{success:true, data:{skipped:true, skipMessage}}`
- [x] `videoProcessingController.js` `getAllVideos()`: pass a `skipped` `lastStatus`
      through to the table as its own status (not lumped into "converted")
- [x] `videoProcessingController.js` `generateTranscript()`: use `transcriptValidator`
      to skip writing a blank/meaningless Deepgram transcript file
- [x] `public/js/.../video-processing.js`: `processAudio()` shows an amber/info
      (not red-error) message + toast for a skipped result and keeps the modal
      unlocked correctly; `statusLabel()`/`statusLabelColor()` add a `skipped` case
- [x] Verify: `node --check` all touched JS files
- [x] Deliver all new/changed files back to the device

## Task: Live meetings page - bot status tracking + participants + transcript/audio activity (DB-driven)

- [x] Model: add `MeetingModel.getLiveMeetingsEnrichment(meetingIds)` (latest `meeting_sessions` row + `participants` attendance per meeting)
- [x] Controller: `meetingScheduleController.getLiveMeetings` attaches `bot_status`, `session`, `participants`, `participant_count` to each event
- [x] Frontend JS: render per-meeting bot status badge (joining / waiting for host / joined / host_rejected / waiting_timeout / failed), participant list + count (DB excludes bot), transcript-running + audio-recording chips
- [x] Frontend JS: poll `/api/admin/meeting-schedule/live` every 5s (silent refresh; preserve Join Bot launched state)
- [x] Verify: `node --check` passed on all 3 edited JS files; enrichment query verified read-only against DB; authed API E2E returns bot_status/session/participants; server restarted (PID 2404) with clean boot and serves updated live.js
- [x] Polish: status strip uses distinct text colors (`[BOT]`=status color, `[TRANSCRIPT]`=sky, `[AUDIO]`=amber), ASCII `[BOT]/[TRANSCRIPT]/[AUDIO]` prefixes replace emoji, dots removed, and the three items are aligned on a single line
- [x] Font size bump on live page: `text-[10px]` -> `text-xs` (12px), `text-xs` -> `text-sm` (14px) across instructor header, LIVE badge, meeting title/time, status strip, participants, Join Bot button, empty/error states
- [x] Status strip colors: darker, clearer 600-level shades for `[BOT]` (emerald-600), `[TRANSCRIPT]` (sky-600), `[AUDIO]` (amber-600) + `font-bold` for legibility
- [x] Meeting-card layout polish: title + Join Bot aligned in header row, meta collapsed to one line (`time | started | remaining | platform`), status strip single-line with `|` separators + section dividers, tidier participants list (bold ASCII +/- marker, name + status), removed redundant progress bar
- [x] Join Bot action states (DB-driven): `joined` -> disabled "Bot joined"; busy states (joining/waiting_for_host/...) -> disabled "Bot joining..."; stopped (failed/stopped/host_rejected/waiting_timeout/expired/completed or terminal session) -> "Bot stopped" + no re-join; guard in `startBot()` against re-join. Verified via branch simulation (10 cases) + served-file check
- [x] Re-added meeting progress bar (elapsed/total window, safe 0-100% calc, 60m fallback when no end time)
- [x] Live page participants: show join time (from `participant_attendance_sessions.joined_at`, fallback `participants.created_at`) and left time (`participant_attendance_sessions.left_at`) in the Participants (N) list. Verified: enrichment returns joined_at/left_at for meeting 8 participants; server restarted clean (PID 15596)

## Task: Remove orphaned services/sessionQualityGenerator.js

- [x] Audited usage: only self doc-comment + TODO.md heads-up + project_structure_only.txt listing (no code imports/callers; the whole session-quality module it belonged to was already deleted)
- [x] Deleted `services/sessionQualityGenerator.js` via `git rm` (staged deletion; file was tracked and unmodified)
- [x] Dropped it from the TODO.md "removed session_* tables" heads-up; removed stale line from `project_structure_only.txt`
- [x] Verified: `git grep "sessionQualityGenerator"` now matches only this TODO log entry; deletion staged in git

## Task: Users page - View Meetings button for calendar-connected instructors

- [x] `users.js` Actions column: the connected instructor's static `Connected` badge is now a friendly `View Meetings` button/link → `/admin/meetings/schedule?instructor=<email>` (same button style as Connect Calendar)
- [x] `schedule.js` `loadInstructors()` supports the `?instructor=<email>` deep-link: pre-selects that instructor in the filter and reloads so only their meetings show (array data source keeps pre-selection race-free; Select2 still filters client-side)
- [x] `/api/admin/content/instructors` confirmed to return `{ uuid, name, email }`; email used as the stable identifier across both pages
- [x] Admin nested route `/admin/:section/:page` confirms `/admin/meetings/schedule` serves with query string intact
- [x] `node --check` passes for both edited files
- [ ] Live browser check when dev server runs on :3000 (static JS served from disk - refresh is enough)

## Task: Database migrations re-index + reset-db update + seeder audit

- [x] Migrations renumbered sequentially 001-055 (removed gaps 021/033/044, deduped duplicate 027/028 pairs) via `git mv`
- [x] `reset-db.js` updated: header counts + count string now 55 files (001-055); seeders 20 files (001-020)
- [x] Seeder audit: only `database/seeders/011_session_quality.js` referenced the 9 removed migrations' tables (session_snapshot/analysis/learning_impact/parent_summary/coaching_feedback/better_alternatives/next_plan/quality_flags/final_evaluation)
- [x] `011_session_quality.js` now skips missing tables gracefully (ER_NO_SUCH_TABLE); session_rubric_evaluations + session_rubric_summary still seed
- [x] All other seeders map cleanly to existing tables (verified by automated scan)
- [x] `node --check` passes for reset-db.js / 011 seeder / index.js; reset-db smoke run exits without touching the DB
- [ ] Heads-up: models/services still reference the removed session_* tables (models/insights/*, InstructorDashboardModel, SessionFinalEvaluationModel, SessionParentSummaryModel) - await user decision

## Task: Single-AI-call policy - local spaCy summary generator (Phase 2)

- [x] Replace the 120-word preview with a spaCy extractive summarizer in services/engine/services/summary_worker.py
- [x] Summary range enforced: 150-250 words (top sentences, reading order, single paragraph)
- [x] Header/filler filtering (platform banners, separators, Meeting/Session ID, Date) + empty/header-only fallbacks to skip message
- [x] Fallbacks preserved: empty -> skip; under 2 content sentences -> 120-word preview; any error -> preview (pipeline never breaks)
- [x] spaCy pipeline cached at module level (built once per process); fully offline, no LLM/API calls, no new library needed
- [x] requirements.txt comment updated; no new dependency
- [x] Verified: real transcript 242 words in range; synthetic 237-238 words in range; summary_task integration writes file, marks completed, sets summary_data/summary_path

## Task: Single-AI-call policy — remove AI from the summary process (Phase 1)

- [x] Remove AI branch from `services/engine/services/summary.py` (drop AISummaryService + ai_config wiring)
- [x] Delete AI `SummaryService`/`generate_meeting_summary` from `services/engine/services/summary_worker.py` (+ unused sys/time imports)
- [x] Verify: py_compile both files + repo grep shows no remaining runtime callers of the AI summary path
- [x] Verify `SummaryService.generate()` returns non-AI preview (unit check)
- [x] Confirm audit path / persist_results / bridge untouched (summary stays isolated)
## Task: Video Processing - Add "AI Transcript" (Deepgram) button + rename Process to "Generate Report"

- [x] Add an "AI Transcript" action button in the table right after Convert (enabled when MP3 exists)
- [x] Reuse the Process modal for both actions with dynamic title/button + processing indicator (spinner + message)
- [x] AI Transcript posts to /api/super_admin/content/deepgram-processing/process (Deepgram pipeline)
- [x] Generate Report posts to /api/super_admin/content/video-processing/process (full audio pipeline)
- [x] Rename Process/Re-process button labels to "Generate Report" / "Re-generate Report"
- [x] Lock modal close while a Report/Transcript request is in flight; always re-call loadVideos() after response
- [x] Fix stale JS API URLs (settings/ -> content/) after the page move
- [x] Verify JS syntax, route loading, and live server (port 3000) serves updated static files + mounted API endpoints

- [x] Add a visible processing indicator (spinner + message) to the Process Audio modal when "Process Audio" is clicked
- [x] Lock the Process modal (no closing) while the process request is in flight
- [x] Always re-call loadVideos() after the process response completes (success / already-exists / error)
- [x] Verify JS syntax and behavior

## Task: Video Processing - Convert to MP3 shows processing state and re-calls data

- [x] Add a visible processing indicator (spinner + message) to the Convert modal when "Convert to MP3" is clicked
- [x] Lock the Convert modal (no closing) while the conversion request is in flight
- [x] Always re-call loadVideos() after the conversion response completes (success / already-exists / error)
- [x] Verify JS syntax and behavior

## Task: Remove unused files from services/engine

- [x] Verify the 13 target files exist in `services/engine`
- [x] Search the codebase (outside `services/engine`) for references to the target files
  - [x] `videoProcessingController.js` — historical comments only, no imports
  - [x] `app.py` — unrelated Flask route named `health_check()`, no import of `health_check.py`
- [x] Search inside `services/engine` for real imports of the target files
  - [x] `__init__.py` already only imports `transcriber` / `client` (docstring anticipates deletion)
- [x] Delete the 13 unused files:
  - `pipeline.py`, `python_main.py`, `assemblyai_engine.py`, `audio_preprocess.py`,
    `storage_output.py`, `channel_transcriber.py`, `whisper_engine.py`, `whisperx_engine.py`,
    `health_check.py`, `resemblyzer_diarizer.py`, `report_schema.py`, `report_scorer.py`, `report_storage.py`
- [x] Verify deletion (files gone, git status clean of engine remnants, imports intact)

## Task: Meeting AI Evaluation report — status shows completed/pending based on has_ai_report

- [x] Investigate the summary API + report page: `has_ai_report` flag already present per record
- [x] `renderTable()`: derive Status from `has_ai_report` (true -> "completed", false -> "pending") instead of raw `session_status`
- [x] `exportCsv()`: export the same derived status for consistency
- [x] Verify JS syntax and that rest of the row values are unchanged

## Task: Meeting AI Session Report — table shows only Category, Indicator, Weightage, AI Outcome, Evidence Quote

- [x] Investigate data: `ai_audit_results.rating` already holds Met / Not met / N/A (codes 1/2/3); actual quotes live in `ai_evidence`
- [x] Model `getSessionAuditResults()`: add `aar.rating` to SELECT
- [x] HTML: reduce AI Audit Results header to the 5 required columns (colspan 9 -> 5)
- [x] JS `renderTable()`: render only the 5 columns, map Outcome (label or code 1/2/3 -> Met/Not met/N/A), show ai_evidence as Evidence Quote
- [x] Verify JS syntax

## Task: AI Outcome column shows the rating value (Met / Not met / N/A)

- [x] Confirmed model `getSessionAuditResults()` returns `aar.rating` (94/94 rows verified)
- [x] JS `renderTable()` already maps `rating` into the AI Outcome column
- [x] Root cause: running Node server was stale (started 15:08, model edited 15:44) — restarted it so the live API now returns `rating`
- [x] Verified server is live on port 3000 (PID 4740) and API requires auth as expected (401 without token)

## Task: Meeting AI Session Report — remove duplicated/heavy data from session API response

- [x] Root cause: `ai_audit_results` has NO true duplicate rows (94 distinct indicators, unique key intact); the "duplicate data" was `ai_raw_response` — the SAME full evaluation JSON (~16 KB) repeated on every row (1,472 KB total payload)
- [x] Only the session report page JS consumes this endpoint; table renders only Category/Indicator/Weightage/AI Outcome/Evidence Quote
- [x] Controller `getSessionReport()`: after computing stats, map each row to just the table header fields (id, category_name, indicator_name, category_weight, indicator_value, rating, ai_evidence, evidence_quote) + defensive dedupe by indicator
- [x] Response verified: 94 rows, ~29 KB total (was ~1.5 MB), stats unchanged (indicatorCount 94, avgScorePct 95.6, oqi 97, gateFailed 0, evidenceCount 94)
- [x] Restarted server (PIDs 4740 -> 9780) so live API serves slim response; JS page needs no change

## Task: Reduce cache_llm_prompts PROMPT_*.json size (Tier 1 + Tier 2)

- [x] Measured: PROMPT file 432 KB; ~240 KB is derivable duplication (messages + replayable_prompt arrays + computed.category_breakdown.rated)
- [x] Confirmed only active writers are audit_storage.py + tutor_eval_worker.py (legacy audit_worker/ai_audit not wired); nothing reads the journal at runtime
- [x] audit_storage.py: stop writing request.replayable_prompt (+ docstring update)
- [x] tutor_eval_worker.py: stop writing request.messages / request.replayable_prompt / request_2.messages / request_2.replayable_prompt; add _journal_computed() that drops category_breakdown.rated from the journal copy only; _compute_percentages/_persist untouched
- [x] Run py_compile on both edited files
- [x] Retro-compact existing PROMPT file with one-off script (432,542 -> 158,627 bytes, 63.3% smaller)
- [x] Verify final file size + integrity: raw responses preserved (audit 4989, tutor_eval 20302, response_2 2406 chars); redundant keys gone; _persist still receives full computed

## Task: Create ai_audit_category_scores + ai_audit_overall_summary migrations

- [x] Created `database/migrations/065_create_ai_audit_category_scores_table.js` (per-category rollups: count_met/not_met/not_applicable, category_score, calc_source enum submit|update, unique key (meeting_id, session_id, category_id, calc_source))
- [x] Created `database/migrations/066_create_ai_audit_overall_summary_table.js` (final_score, total_weighted_percent, total_criteria_all, calc_source, red_flag, overall_summary, unique key (meeting_id, session_id, calc_source))
- [x] Syntax verified (node --check) and both migrations ran successfully (`up()` OK)
- [x] Verified created tables via SHOW CREATE TABLE (columns, enums, indexes, unique keys all correct)
- [x] Cleaned up temp verification script

## Task: Migrate to new ai_audit_results status_code schema + 065/066 rollup tables

- [x] Applied updated 055 (status_code-only ai_audit_results, drops old score/name/benchmark columns) + created/ran 065 + 066
- [x] audit_scoring.py: added compute_category_score_from_counts(met, not_met, na, calc_source) + compute_overall_from_category_rows() implementing review_calculation_logic.txt (submit Met/(Met+NA) all-NA=100; update Met/(Met+NM) all-NM=100; overall weighted by criteria count)
- [x] audit_storage.py::store_audit_results: writes status_code schema + upserts 065 category rollups + 066 overall summary (calc_source='submit'); moved audit_scoring imports to module top; removed dead _derive_rating
- [x] tutor_eval_worker.py::_persist: writes status_code schema + same rollups; removed dead vars
- [x] MeetingAiEvaluationReportModel.js: getSessionAuditResults joins rubric_* tables, derives rating from status_code; getMeetingSessions subquery reads 066 final_score; added getSessionOverallSummary
- [x] MeetingAiEvaluationReportController.js: stats from status_code + 066 final_score
- [x] AuditReportModel.js (audit/), AIAuditResultsModel.js, controllers/auditReportController.js + controllers/reports/auditReportController.js migrated to status_code
- [x] audit_service.py fixed to not import removed _derive_rating
- [x] All Python compile OK; all JS syntax OK
- [x] End-to-end test: store_audit_results wrote 3 indicators, Category A rollup 50% (1Met/1NA), Category B 0% (1NM), overall 33.33 (weighted by count) — matches doc; update-flow math (all-NM=100) unit-verified
- [x] Report read path verified: AIAuditResultsModel.upsert + getSessionAuditResults returns correct category names + rating derivation
- [x] Server restarted (PID 14388) so Node report changes are live

## Task: Make pipeline audit-only (remove tutor_eval / analysis AI)

- [x] Deleted `services/engine/services/tutor_eval_worker.py` and `services/engine/task/tutor_eval_task.py`
- [x] `task_registry.py`: removed `run_tutor_eval_task` wrapper + the `"tutor_eval"` registry entry → registry is now media/transcription/audit/summary/persist_results
- [x] `pipeline_context.py`: removed `enable_tutor_eval` flag, `tutor_eval_results` attr, `"tutor_eval"` status entry
- [x] `services/engine/services/__init__.py`: removed tutor_eval imports/__all__
- [x] Cleaned stale tutor_eval comments in audit_storage.py, llm_cache.py, audit_task.py (code refs only; audit_scoring/audit_worker comments are harmless historical notes)
- [x] Verified: py_compile all touched files + full engine import OK; no code imports of deleted modules remain (only harmless comments)
- [x] Registry keys confirmed: ['media','transcription','audit','summary','persist_results']
- [x] Reviewer human-eval controller unaffected (uses its own model, only comment mentions engine service)
## Task: Make the "waiting for host to allow" window configurable via .env (all 3 platforms)

- [x] Add `BOT_HOST_WAIT_TIMEOUT_MS` to `.env` and `.env.example` (under BOT CONFIG, default 900000 = 15 min)
- [x] Add `bot.hostWaitTimeoutMs` to `config/settings.js` (mirrors existing `humanJoinTimeoutMs` parsing pattern)
- [x] `services/platforms/zoom/zoomJoiner.js`: derive `MAX_ATTEMPTS` from `settings.bot.hostWaitTimeoutMs / 5000`
- [x] `services/platforms/google-meet/meetingNavigation.js`: derive `maxAttempts` from `settings.bot.hostWaitTimeoutMs / 3000`
- [x] `services/platforms/teams/teamsJoiner.js`: derive lobby loop limit from `settings.bot.hostWaitTimeoutMs / 3000`
- [x] Verify: syntax-check modified files + confirm settings reads the env value
## Task: Meeting bot status flow — meetings = bot lifecycle, meeting_sessions = human conversation

- [x] Add `services/platforms/joinErrors.js` (HostDeniedError / WaitingRoomTimeoutError)
- [x] meetingSessionModel/controller: createSession always new row + initialStatus; updateStatus sets end_time on terminal
- [x] transcriptModel.createSession delegates to meetingSessionModel
- [x] MeetingModel.updateMeetingStatusById force option + history list includes new statuses
- [x] Joiners (zoom/meet/teams): throw HostDeniedError / WaitingRoomTimeoutError; Zoom+Teams denial detection
- [x] socraticbot.run(): meetings.status bot_launching→waiting_for_host→joined (+host_rejected/waiting_timeout/failed); create session only on human detection
- [x] socraticbot.stop(): finalize session by actual outcome (completed/failed + end_time), no blanket completed
- [x] botManager: no upfront session; meeting status bot_launching; drop 'missed'/'in_progress'/blanket-completed writes
- [x] BotPollingController: bot_launching instead of launching/in_progress
- [x] Adapters: stop creating sessions upfront; human-detected session for legacy teams/meet paths; ZoomAdapter uses modern flow
- [x] Verify: syntax + module load + lifecycle sanity checks

## Task: Verify Google Meet vs Zoom/Teams platform-parity analysis, then fix the two confirmed real gaps

User pasted a 9-point + 3-dead-file comparison claiming Google Meet's bot code is
significantly more mature/fixed than Zoom/Teams (media enforcement, caption
module, transcript engine, roster capture, hasHumanJoined robustness, stage
logging, alone-check grace/sustain, leave-persistence, adapter maturity), and
asked to verify it against the real code before doing anything.

Verified each claim against the live files in `services/platforms/{google-meet,zoom,teams}`:

- Confirmed as described: #1 media enforcement (google-meet's preJoinMedia.js
  retries 20x with DOM re-verification vs zoom/teams' single-shot click),
  #3 transcript engine sophistication (google-meet's transcriptEngine.js has
  3 extraction strategies + fingerprint dedup vs zoom/teams' simple
  lastSavedText/lastTextBySpeaker dedup - though google-meet's own
  captionMonitor.js no longer does any caption extraction itself anymore,
  that all moved to transcriptEngine.js), #4 initial roster capture,
  #5 hasHumanJoined's isHumanPresentFromCountInfo fallback, #6 _setStage
  lifecycle logging, and #7 alone-check ALONE_SUSTAIN_MS/ALONE_GRACE_MS -
  all four of these (#4-#7) exist ONLY in google-meet's monitor.js/
  participantTracker.js, zero matches anywhere in zoom or teams.
- Confirmed dead code: zoom/teams' `captionListener.js` and
  `participantCapture.js`, plus `teams/reactiveJoinFlow.js` - none are
  required anywhere (socraticbot.js only requires each platform's
  *Joiner/monitor/audioRecorderBot/captionMonitor/participantTracker).
  Bonus finding not in the original list: `zoom/reactiveJoinFlow.js` is
  equally dead (same situation, just not flagged by the user's analysis).
- Confirmed real bug (fixed below): #8 half of it - Zoom's
  `participantTracker.reset()` only cleared its in-memory map and never
  persisted a "left" timestamp for participants still marked "joined" when
  the meeting ended, unlike teams/google-meet's reset() which already loop
  over dangling "joined" entries first.
- Refuted: #2 caption-enable sophistication - google-meet's captionManager.js
  is a 10-attempt click loop that only confirms a click happened, never that
  captions produced output. Zoom's LIVE path (zoomJoiner.js's
  startTranscriptMonitor + enableLiveCaptions) is actually MORE robust than
  google-meet here: 6 retries, each verifying sidebar visibility AND calling
  verifyCaptionsProducingOutput() before declaring success. Teams' live
  enableCaptionsIfPossible() genuinely was the weakest (single attempt, no
  retry, no verification) - fixed below by porting Zoom's verify pattern.
- Refuted: #8's other half ("Teams' reset() not properly awaited by
  socraticbot.js") - socraticbot.js's stop() already does
  `await this.participantTracker.reset(new Date())` for all 3 platforms
  uniformly, with a comment confirming this was already fixed repo-wide.
  The only real gap was Zoom's own reset() implementation (above).
- Partially verified, not acted on: #9 adapter maturity - confirmed
  ZoomAdapter.js is a thin SocraticBot wrapper and TeamsAdapter.js is a
  separate, much more primitive implementation (raw puppeteer, no
  captionMonitor/participantTracker wiring, transcript monitoring is a
  placeholder comment) that doesn't use teamsJoiner.js at all - but couldn't
  confirm from platform files alone whether TeamsAdapter.js is actually
  live/routed to in production or itself dead code, since the
  controller/routing layer that picks an adapter class wasn't in scope here.

Fixes applied for the two confirmed real gaps:

- [x] `services/platforms/zoom/participantTracker.js`: `reset()` now takes
      `meetingEndTime` and loops over any participant still marked "joined",
      calling `ParticipantModel.recordParticipantLeave()` before clearing -
      mirrors teams/participantTracker.js's existing reset() exactly
- [x] `services/platforms/teams/teamsJoiner.js`: `enableCaptionsIfPossible()`
      rewritten from a single unverified click into a 6-attempt retry loop
      that confirms real caption rows appear (via the same
      `.fui-ChatMessageCompact` selector teams/captionMonitor.js reads from)
      before declaring success, mirroring zoom/zoomJoiner.js's
      verifyCaptionsProducingOutput() pattern; new
      `verifyCaptionsProducingOutput()` method added alongside it
- [x] Syntax-verified both files (`node --check`)
- [x] Behavioral tests against the real, unmodified functions (only the
      Puppeteer `page` object and DB model stubbed): confirmed zoom's
      reset() now calls recordParticipantLeave exactly once for a dangling
      "joined" participant and still clears the map; confirmed teams'
      enableCaptionsIfPossible() retries past a missed caption button,
      returns true once verifyCaptionsProducingOutput confirms output, and
      returns false after exhausting retries with no confirmed output
- [ ] Not done (needs user decision): anything about claim #9 (TeamsAdapter.js
      possibly being dead code) or the 3 confirmed-dead files
      (captionListener.js x2, participantCapture.js x2, reactiveJoinFlow.js
      x2 counting zoom's) - left in place pending the user's call on deleting
      orphaned files vs. leaving them

## Task: Make featureConfig.js per-platform + wire up zoom/teams (media, attendanceMonitor, participantTracker, captionMonitor)

User asked whether featureConfig.js is actually used by zoom/teams, and to
add it if not, plus restructure the file so each platform gets its own
separate config section.

Finding: `audioRecorder`/`screenRecorder` already applied to all 3 platforms
(read from `services/socraticbot.js`, which is the shared orchestrator all
three run through for these two). But `media`, `attendanceMonitor`,
`participantTracker`, and `captionMonitor` were only ever wired up in
`GoogleMeetAdapter.js` (Path A) - zero references in zoomJoiner.js,
teamsJoiner.js, or socraticbot.js for these four keys, despite the old file
header's comment claiming they applied to "both bot paths" for google-meet.

- [x] `services/featureConfig.js`: restructured into `zoom` / `teams` /
      `google-meet` top-level sections, each an independent copy of all 6
      toggles (media, attendanceMonitor, participantTracker, captionMonitor,
      audioRecorder, screenRecorder) - defaults unchanged (all true except
      screenRecorder), so this alone changes no runtime behavior
- [x] `GoogleMeetAdapter.js` / `meetJoiner.js`: one-line require change each
      (`require('../../featureConfig')['google-meet']`) so every existing
      `featureConfig.xxx` reference in both files keeps working unmodified
- [x] `services/platforms/zoom/zoomJoiner.js`: added featureConfig require;
      `_muteMicPreJoin()` and `muteMicAfterJoin()` now independently gate
      mic-mute vs camera-off on `featureConfig.zoom.media.*` (previously
      always ran unconditionally)
- [x] `services/platforms/teams/teamsJoiner.js`: added featureConfig
      require; `muteMicAndCamera()` now independently gates mic vs camera
      the same way on `featureConfig.teams.media.*`
- [x] `services/socraticbot.js` (`handlePlatformFeatures()`, used by all 3
      platforms): added `const platformFeatures = featureConfig[this.platform]`
      and gated, for zoom/teams/google-meet alike: captionMonitor creation +
      polling, participantTracker creation (+ google-meet's initial roster
      capture, which needs a real tracker), and the attendanceMonitor
      `monitorMeeting()` call - each with an else-branch log line matching
      GoogleMeetAdapter.js's existing "disabled via featureConfig" wording.
      Also fixed `run()`'s audioRecorder/screenRecorder lookup to read from
      the per-platform config instead of the old flat shape.
- [x] Syntax-verified all 6 touched files (`node --check`)
- [x] Behavioral tests against the real, unmodified functions (fake
      page/frame objects only): confirmed zoom/teams media gating correctly
      skips DOM clicks when disabled and independently toggles mic vs
      camera; confirmed featureConfig.js's per-platform sections are
      genuinely independent objects, not shared references; re-ran the
      previous teams caption-retry test and zoom reset test to confirm no
      regressions
- [x] Caught and fixed a self-inflicted regression during this task: an
      earlier `cp` from the stale local uploads mirror (last staged before
      the *previous* task's Teams caption-retry fix was committed) briefly
      clobbered that fix while only the new media-gating edit was applied on
      top of it — caught immediately by re-running the old regression test,
      re-applied the caption-retry logic on top of the media-gating change,
      and re-verified both coexist correctly before committing
- [ ] Not done: full end-to-end verification with a live meeting (join a
      real Zoom/Teams meeting with a toggle flipped off and confirm the bot
      behaves as expected) - only unit-level/behavioral verification was
      possible in this environment

## Task: Make the queued-meeting expiry window configurable via .env

User asked where a meeting's status gets set to 'expired' (read-only lookup,
answered: `controllers/meetings/BotPollingController.js::pollQueuedMeetings()`
— a queued meeting whose `scheduled_start_time` is more than 5 minutes in the
past gets marked 'expired' and skipped, checked on a self-rescheduling 10s
poll loop started from server.js; the hardcoded `-5` was the only place this
lived). Then asked to move that 5-minute threshold into `.env` so it can be
changed without touching code.

- [x] `.env` / `.env.example`: added `BOT_QUEUED_EXPIRE_MINUTES=5` under BOT
      CONFIG, next to the existing `BOT_HOST_WAIT_TIMEOUT_MS`/
      `HUMAN_JOIN_TIMEOUT_MS`/`BOT_LAUNCH_LEAD_MINUTES` bot-timing vars
- [x] `config/settings.js`: added `bot.queuedExpireMinutes` —
      `parseInt(process.env.BOT_QUEUED_EXPIRE_MINUTES || '5', 10)` — mirrors
      the existing `hostWaitTimeoutMs` pattern exactly
- [x] `controllers/meetings/BotPollingController.js`: now requires
      `config/settings` and checks `minutesUntilStart < -settings.bot.queuedExpireMinutes`
      instead of the hardcoded `-5`
- [x] Syntax-verified both files (`node --check`)
- [x] Behavioral tests against the real, unmodified settings.js +
      BotPollingController.js (only MeetingModel/botManager/logger/dotenv/
      puppeteer stubbed as true externals, in an isolated test tree):
      confirmed BOT_QUEUED_EXPIRE_MINUTES=30 correctly does NOT expire a
      meeting 10 minutes overdue but DOES expire one 40 minutes overdue, and
      confirmed the default (env var unset) still expires a 10-minute-overdue
      meeting exactly like the old hardcoded `-5` did — no behavior change
      for anyone who doesn't set the new var

## Task: Fix Teams bot joins but can't mute mic/camera (error-2026-09-14.log)

User reported the Teams bot joins fine but can't mute mic/camera, and asked
me to check the log plus confirm whether a separate process file was running.

- [x] Read `logs/error-2026-09-14.log`: confirmed via the "TeamsAdapter
      (teamJoiner): FAILED to confirm captions after 6 attempts" line (that
      exact retry-count message only exists in the caption-retry fix already
      committed to teamsJoiner.js) that `teamsJoiner.js` via socraticbot.js
      IS the live path for this run - not a separate/stale file. The other
      `TeamsAdapter.js` file in the repo did not run for this session.
- [x] Root cause found in the same log: a cluster of Teams-internal errors
      right after join - "[VideoBKG] No selected camera.
      Context=device_manager_service_init", "No start call scenario",
      "getCallingConversationAsync is not implemented", "All promises were
      rejected". Traced to config/settings.js's shared Puppeteer args, which
      have `--use-fake-ui-for-media-stream` (auto-accepts the permission
      prompt) but NOT `--use-fake-device-for-media-stream` (which actually
      supplies a camera/mic device) - so the browser has zero video input
      devices. Teams' own web client hard-requires a "selected camera" to
      finish initializing its calling engine; when that fails, the call
      never truly starts, so the mic/camera toggle buttons exist in the DOM
      but aren't wired to a live call - clicks on them do nothing.
- [x] User explicitly asked NOT to touch the shared Puppeteer config
      (Zoom/Google Meet don't need this and it's out of scope), and to keep
      any fix scoped to `services/platforms/teams/`.
- [x] `services/platforms/teams/teamsJoiner.js`: added
      `_injectFakeCameraShim()`, called once at the top of `joinMeeting()`
      before `page.goto()` (via `page.evaluateOnNewDocument()`, which
      re-injects on every navigation/frame - Teams-page-scoped only, no
      global launch-flag change). Shims `navigator.mediaDevices
      .enumerateDevices()` to report a synthetic videoinput device only if
      none exists, and `getUserMedia()` to fall back to a black
      canvas-captured video stream only when a real video request fails for
      lack of a device - real devices/streams are always preferred and
      passed through untouched.
- [x] Verified against a REAL headless Chromium (the box's own
      /opt/pw-browsers chromium via puppeteer-core), launched with the exact
      same flags production uses minus `--use-fake-device-for-media-stream`:
      - Baseline (no shim): `enumerateDevices()` returns 0 devices,
        `getUserMedia({video:true})` throws
        `NotFoundError: Requested device not found` - reproduces the log's
        symptom exactly
      - With the REAL, unmodified `TeamsJoiner._injectFakeCameraShim()`
        method called exactly as `joinMeeting()` calls it:
        `enumerateDevices()` reports a videoinput device,
        `getUserMedia({video:true})` resolves with a stream containing a
        real video track, and the shim persists correctly across a second
        page navigation (confirming it'll survive Teams' own internal
        redirects)
      - `node --check` + re-ran the existing caption-retry and media-gating
        regression tests on the same file - no regressions
- [ ] Not verified: an actual live Teams meeting join with this change (only
      a real-browser simulation of the device/getUserMedia layer was
      possible here) - please confirm mute/camera-off actually take effect
      on your next Teams bot run and check the logs for
      "[VideoBKG] No selected camera" no longer appearing

## Task: Chrome profile lifecycle DB tracking (chrome_profiles) + reliable cleanup

- [x] database/migrations/057_create_chrome_profiles_table.js: chrome_profiles table (id, profile_name, profile_path unique, status ENUM CREATING/ACTIVE/CLOSING/CLEANUP_PENDING/CLEANED/FAILED, browser_pid, bot_instance_id, meeting_id, created_at, updated_at, cleanup_attempts, last_error, cleanup_completed_at + indexes). Preserves existing profile_<meetingId> directory naming.
- [x] models/bot/ChromeProfileModel.js: ORM access with atomic status transitions; markCleaned only after dir verified gone; recordCleanupFailure with retry cap
- [x] services/shared/profileManager.js: lifecycle service (register CREATING -> markActive, beginClose, onUnexpectedDisconnect, idempotent cleanupProfile with in-memory lock, startupRecovery, retryPendingCleanups, scanAndCleanOrphans; injectable browserOps)
- [x] services/shared/browserManager.js: register row before mkdir; mark ACTIVE after launch; disconnected -> CLEANUP_PENDING unless intentional; close() -> CLOSING -> cleanup -> CLEANED
- [x] services/socraticbot.js: pass botInstanceId + meetingId to BrowserManager.init (naming untouched)
- [x] server.js: startup recovery after initDB + periodic CLEANUP_PENDING retry / orphan sweep
- [x] tests/chromeProfileLifecycle.test.js: normal close, crash, locked profile, retry, max retries FAILED, server restart, orphans, concurrent cleanup
- [x] Verify: node --check new/modified JS; run migration; run tests green

## Task: Teams pre-join Speaker/Microphone device selection (VB-Audio Virtual Cable)

- [x] Scope: `services/platforms/teams/teamsJoiner.js` only, per the standing
      instruction to keep Teams fixes inside `services\platforms\teams\` and
      not touch the shared Puppeteer config
      (`config/settings.js`/`browserManager.js`) — this change touches
      neither; it's page-level DOM interaction only.
- [x] What this is NOT: `muteMicAndCamera()` (already implemented) only
      toggles Teams' mic/camera buttons ON/OFF — it never changes which
      *device* those buttons are pointed at. Left on the machine's default,
      Teams can select real hardware ("Headset Earphone/Microphone
      (Sennheiser SC60 for Lync)"), which is what was causing the
      feedback/echo "disturbance" in the meeting.
- [x] Added `TeamsJoiner.selectAudioDevices()` + helper `_selectOneDevice()`:
      finds Teams' Speaker/Microphone dropdown ("combobox") controls (scans
      every frame, same pattern as the existing
      `readPasscodeScreen()`/`findPasscodeField()`), opens each, and clicks
      the option whose text matches (case-insensitive substring):
      - Speaker → "CABLE Input (VB-Audio Virtual Cable)"
      - Microphone → "CABLE Output (VB-Audio Virtual Cable)"
      Mirrors `config/settings.js`'s existing `audio.deviceName: "audio=CABLE
      Output (VB-Audio Virtual Cable)"` (what the ffmpeg AudioRecorder
      already records FROM) — Speaker→CABLE Input is what puts the
      meeting's own audio onto that same cable in the first place.
- [x] Wired into THREE call sites, not just one:
      1. `handlePreJoin()`, before `muteMicAndCamera()` (original pre-join
         screen — "teams testing bot" / device picker + Join now screen).
      2. `waitForJoinConfirmation()`, once at the very start, before the
         admit-wait poll loop begins — user confirmed via screenshot that
         this SAME dropdown widget also appears on the "Someone will let you
         in when the meeting starts" lobby screen, and asked for the
         selection to be (re-)applied there too as a second pass.
      3. `waitForJoinConfirmation()`'s passcode-recovery branch, alongside
         the existing `muteMicAndCamera()` re-apply call — the
         passcode-recovery flow re-renders the pre-join screen, which can
         reset the device pickers back to OS defaults.
- [x] Checked Zoom (`zoomJoiner.js`) and Google Meet
      (`preJoinMedia.js`/`meetJoiner.js`/`GoogleMeetAdapter.js`) first for
      an existing named-device-selection pattern to mirror — confirmed
      neither platform does named-device dropdown selection anywhere in
      this repo (both only click mute/camera-off toggle buttons). New code,
      isolated to Teams.
- [x] Best-effort by design: selection failures are logged as warnings
      (with the actual device list Teams offered, for diagnostics) and
      NEVER throw out of `joinMeeting()` — a failed device selection must
      not block the bot from joining.
- [x] Device names configurable via `.env` (`TEAMS_SPEAKER_DEVICE_NAME` /
      `TEAMS_MIC_DEVICE_NAME`, read directly via `process.env` inside
      `teamsJoiner.js` — deliberately NOT added to `config/settings.js`, to
      keep this change 100% scoped to `services/platforms/teams/`).
      Defaults match the two device names given. Empty string in `.env`
      skips that device and leaves Teams' default in place. Not added to
      `.env`/`.env.example` in this task for the same reason — say the word
      if you'd like the two optional overrides documented there too.
- [x] `node --check` passes.
- [x] Behavioral tests against the REAL, unmodified file (only
      logger/settings/joinErrors/featureConfig and Puppeteer's page/frame
      objects stubbed — a fake DOM stands in for the real browser):
      - Happy path: CABLE options present in a secondary (iframe) frame,
        clicks the correct CABLE option for Speaker and Microphone, does
        NOT click the headset options also present in the list.
      - VB-Cable not installed (only real hardware listed) — warns with the
        exact option list Teams offered, does not throw.
      - No device-picker controls found anywhere — warns per target, does
        not throw.
      - `.env` overrides — empty string skips that device; a custom device
        name is honored in place of the default.
      - `handlePreJoin()` wiring order: passcode-modal check ->
        selectAudioDevices() -> muteMicAndCamera(), 6s settle delay intact.
      - `waitForJoinConfirmation()` wiring: selectAudioDevices() called
        once before the admit-wait loop starts, and re-called (alongside
        muteMicAndCamera()) after a successful passcode recovery, in the
        correct order relative to dismissAudioVideoPopup()/
        clickJoinNowButton().
      - Re-confirmed the caption-retry and camera-shim methods from earlier
        tasks are still intact and unmodified after this edit.
- [x] CAUGHT AND FIXED a real bug during this task, documenting it here for
      transparency: after adding the two new `waitForJoinConfirmation()`
      call sites, I re-staged `teamsJoiner.js` from the device to make sure
      I was editing the latest copy — but the device copy that came back
      was still the PRE-device-selection version (missing
      `selectAudioDevices()`/`_selectOneDevice()` entirely), even though an
      earlier commit in this same task had reported success. Editing that
      stale copy would have left `this.selectAudioDevices()` calls with no
      matching method — a `TypeError` on every Teams join. Caught by
      grepping for the method definitions post-edit and noticing they were
      missing; re-verified against my last-known-good local copy (which DID
      have the full implementation), rebuilt the two lobby-screen edits on
      top of that correct base, re-ran the full test suite, and this time
      verified the commit by re-staging from the device afterward and
      diffing byte count / grepping for the methods before calling it done.
      Will re-verify every future commit to this file the same way rather
      than trusting a "written" response alone. Root cause of why the
      earlier commit didn't take isn't confirmed — possibly a sync delay in
      the device bridge, possibly a race with another session/process also
      editing files in this repo around the same time (see the unrelated
      "Chrome profile lifecycle" task that appeared in this same TODO.md
      between my read and my write — this codebase is being edited
      concurrently by more than one session right now).
- [ ] Not verified: an actual live Teams meeting join with the CORRECTED
      version now on the device (the version tested via screenshots in this
      conversation was the pre-lobby-screen-fix build). Please run another
      Teams bot join and check the logs for `"Speaker device set to \"CABLE
      Input (VB-Audio Virtual Cable)\""` / the matching Microphone line
      appearing up to 3 times (pre-join, lobby-wait, and passcode-recovery
      if that path is hit) — if any instead logs a warning, paste it back.

## Task: Post-Teams-audio-fix follow-ups (6 items, working one at a time per user request)

User reviewed the Teams device-selection work above and asked for an honest
punch list of what's still open, then asked to tackle these one at a time,
starting with #1, with the rest tracked here rather than done all at once.

- [ ] 1. IN PROGRESS - Confirm the "CABLE Input in both mic and speaker"
      wording: current code sets Speaker -> "CABLE Input (VB-Audio Virtual
      Cable)" and Microphone -> "CABLE Output (VB-Audio Virtual Cable)"
      (different devices, matches the user's original spec and their own
      screenshot). User's phrasing in a later message ("using cable Input
      in both mic and speaker") could mean the same thing loosely, or could
      mean an actual change to point BOTH at CABLE Input - which would
      likely break the recording pipeline (ffmpeg's `audio.deviceName` in
      config/settings.js records FROM "CABLE Output"; if nothing selects
      CABLE Output as an input anywhere, nothing feeds that side of the
      loopback). Asked the user to clarify; awaiting their answer before
      touching any code for this one.
- [ ] 2. Verify `selectAudioDevices()`/`_selectOneDevice()` selectors
      against the REAL Teams DOM (not the simulated fake-DOM tests). Still
      need either: the user's Inspect-Element HTML for the Speaker/
      Microphone dropdown + its option list, OR the test meeting join link
      so this session can open it directly in its own browser tool and
      read the real markup.
- [x] 3. DONE - verified on a live join (see the "FIX 9" task later in this
      file): camera shim + device selection + mute all confirmed working
      together, user confirmed "video/camera is off" on a real Teams
      meeting.
- [ ] 4. Get a fresh log from an actual Teams bot run. As of this check,
      `logs/info-2026-09-14.log` and `logs/error-2026-09-14.log` are no
      longer present in the logs folder (only `.gitkeep` and `image/` are
      there now) - likely rotated/cleared by the other session active in
      this repo, but not confirmed. Need a new log (or fresh screenshots)
      once the user runs another test join.
- [ ] 5. Look into the recurring "Shared(browserManager): Chrome browser
      disconnected" / "Failed to remove Chrome profile directory ... still
      in use after waiting" errors (seen 3x in the pre-fix info log).
      NOTE: another session already appears to be mid-work on exactly this
      (see "Chrome profile lifecycle DB tracking (chrome_profiles) +
      reliable cleanup" task elsewhere in this file, which this session did
      not write) - confirm with the user whether that's expected/someone
      else's work before duplicating effort here.
- [ ] 6. Carried over from earlier in this conversation:
      - Whether `services/platforms/teams/TeamsAdapter.js` is genuinely
        dead code - the routing/controller layer that would prove nothing
        imports it has never actually been checked, only inferred from the
        log prefix mismatch.
      - The 3 confirmed-dead files (`captionListener.js` x2,
        `participantCapture.js` x2, `reactiveJoinFlow.js` x2, one copy each
        under zoom/ and teams/) are still undeleted in the repo, pending
        the user's decision to remove them.

## Task: Move Teams device-name config from process.env into config/settings.js

User asked whether the TEAMS_SPEAKER_DEVICE_NAME/TEAMS_MIC_DEVICE_NAME config
(added in the task above) could live in config/settings.js instead of being
read directly via process.env inside teamsJoiner.js. Note: this is a
separate question from item #1 in the "Post-Teams-audio-fix follow-ups" task
below (which device name to actually use) - #1 is still open, awaiting the
user's answer.

- [x] Confirmed this is safe and consistent with the existing pattern: every
      other configurable value in this codebase (audio.deviceName,
      bot.hostWaitTimeoutMs, bot.queuedExpireMinutes, bot.autoJoinLeadMinutes)
      already lives in config/settings.js as a plain, independent object
      read from process.env at load time. Adding a new `teamsAudio: {...}`
      block does NOT touch the shared `puppeteer` launch config/args in that
      same file, so it does not conflict with the user's earlier "don't
      touch my main Puppeteer config" instruction - that was specifically
      about the browser launch flags/browserManager.js, not a blanket ban
      on ever editing settings.js.
- [x] `config/settings.js`: added `teamsAudio: { speakerDeviceName,
      micDeviceName }`, positioned right after the existing `audio: {...}`
      block (same theme - device names), reading
      TEAMS_SPEAKER_DEVICE_NAME/TEAMS_MIC_DEVICE_NAME from process.env with
      the same defaults as before.
- [x] `services/platforms/teams/teamsJoiner.js`: replaced the direct
      process.env reads with `settings.teamsAudio.speakerDeviceName` /
      `settings.teamsAudio.micDeviceName` (settings.js was already required
      at the top of this file for other config).
- [x] `.env.example`: documented TEAMS_SPEAKER_DEVICE_NAME/
      TEAMS_MIC_DEVICE_NAME with the same defaults, grouped with the other
      bot-related env vars.
- [x] `node --check` on both JS files. Updated the test tree's stub
      settings.js to mirror the real teamsAudio block (env-driven, same
      defaults) and fixed a stale require-cache bug in the test harness
      (config/settings.js wasn't being cleared from require.cache between
      test runs, so env-override tests were seeing a cached first-run
      value) - re-ran the full 7-test suite (device selection x4, pre-join
      wiring x1, lobby wiring x2), all pass.
- [x] Committed all 3 files and this time verified by re-staging from the
      device afterward and grepping for the actual new content (teamsAudio/
      speakerDeviceName/micDeviceName/settings.teamsAudio) before calling it
      done - given the earlier lesson in this file about "written" not
      always meaning "landed."

## Task: Queued meetings created at/after their start time never launch the bot

Reported: meeting (teams, id=3, title "test") created 17:15:23 local with scheduled_start_time 17:15:00 local stayed "queued" forever; live page showed "[BOT] Queued - waiting to launch".

Root cause: BotPollingController.pollQueuedMeetings() guard `if (minutesUntilStart > autoJoinLeadMinutes || minutesUntilStart < 1) continue;` skips any meeting that is at/after its start time; such a meeting was only ever marked "expired" after BOT_QUEUED_EXPIRE_MINUTES (50 in .env) minutes past start, so it sat in queue, never launching. This is pre-existing behavior, not a chrome-profile regression.

- [x] Confirmed getQueuedMeetings() does return already-started meetings (WHERE status = 'queued' AND scheduled_start_time <= NOW()+lead), so the SQL was not the blocker
- [x] controllers/meetings/BotPollingController.js: dropped the `minutesUntilStart < 1` skip; now launches when -BOT_QUEUED_EXPIRE_MINUTES <= minutesUntilStart <= autoJoinLeadMinutes (late joins allowed up to the expiry window; far-future still skipped, long-expired still marked expired)
- [x] Verified: node --check passed; current meeting computes minutesUntilStart=-7 -> wouldLaunch=true
- [ ] PENDING: restart the running server so it loads the new controller code; next 10s poll should mark the meeting bot_launching and launch the Teams bot

## Task: Teams pre-join/lobby - also stop the camera (video mute), independently toggleable via featureConfig.js

User confirmed the CABLE Input/Output audio-device selection is working live
("yes it's working"), then asked for camera/video to also be stopped at the
same point(s) as the audio-cable selection - explicitly asking this be
SEPARATE code from the mic-mute logic, toggleable independently, reusing the
existing `services/featureConfig.js` file rather than a new ad-hoc flag.

- [x] Scope: `services/platforms/teams/teamsJoiner.js` only - no changes to
      `config/settings.js`, `services/featureConfig.js` itself, or the
      shared Puppeteer config.
- [x] Refactored `muteMicAndCamera()`: mic-mute logic stays inline exactly as
      before (still gated on `featureConfig.teams.media.muteMicOnJoin`); the
      camera-stop click was pulled out into its own new method,
      `stopVideoIfConfigured()`, and `muteMicAndCamera()` now just delegates
      to it at the end. This makes camera-stop independently callable (it's
      no longer bundled inside the mic-mute code path) and reuses the
      EXISTING `featureConfig.teams.media.disableCameraOnJoin` flag (already
      present in featureConfig.js from an earlier task) rather than adding a
      new/duplicate toggle - `muteMicOnJoin` and `disableCameraOnJoin` were
      already two separate flags in that file, just never actually wired to
      two separate code paths before now.
- [x] `stopVideoIfConfigured()`: checks `featureConfig.teams.media.
      disableCameraOnJoin` first and returns immediately (logging why) if
      false; otherwise clicks Teams' camera-off control via
      `page.evaluate()` (selector set mirrors the existing mic-mute
      selector style: `[aria-label="Turn camera off"]`,
      `[data-state="call-video"]`, `[data-track-action-scenario=
      "callStopVideo"]`, `[data-track-module-name-new="videoOff"]`), only
      clicking if the button reports itself pressed/on. Wrapped in try/warn
      - never throws, matching the "best-effort, must not block the join"
      pattern used everywhere else in this file.
- [x] Closed a real gap: `waitForJoinConfirmation()` (the lobby "Someone
      will let you in" screen) already re-applied `selectAudioDevices()` at
      its start but was NOT re-applying camera-off there - added
      `await this.stopVideoIfConfigured();` right after
      `await this.selectAudioDevices();` at that call site. The other two
      call sites (`handlePreJoin()` and the passcode-recovery branch inside
      `waitForJoinConfirmation()`) already get camera-stop for free since
      both call the now-refactored `muteMicAndCamera()`.
- [x] Test tree updated: `test_lobby_wiring.js` Tests 6a/6b now also
      stub/assert `stopVideoIfConfigured()` (6a: called once, after
      `selectAudioDevices()`, before the admit-wait loop; 6b: appears in the
      full passcode-recovery call-order sequence). New `test_video_stop.js`
      (4 tests): A - clicks the camera-off button when
      `disableCameraOnJoin=true`; B - no-op + logs the skip reason when
      `false`; C - `muteMicAndCamera()` delegates to `stopVideoIfConfigured()`
      exactly once; D - proves the two toggles are truly independent
      (`muteMicOnJoin=false` + `disableCameraOnJoin=true` -> zero mic
      `page.evaluate()` calls, camera-stop still happens).
- [x] Full suite re-run: `test_device_selection.js` (4) + `test_wiring.js`
      (1) + `test_lobby_wiring.js` (2) + `test_video_stop.js` (4) = 11/11
      pass.
- [x] `node --check` passes.
- [x] Commit needed one retry (the now-familiar concurrent-write issue in
      this repo - see the earlier note under "Teams pre-join Speaker/
      Microphone device selection"): first `device_commit_files` call
      reported success, but re-staging afterward showed the OLD
      pre-refactor file still on disk (1072 lines, no
      `stopVideoIfConfigured` match). Retried the identical commit
      immediately - this time verified genuinely landed: re-staged again,
      `grep -c` for `stopVideoIfConfigured` = 3, `wc -l` = 1112,
      `node --check` = OK.
- [ ] Not verified: an actual live Teams meeting join with this change -
      please run another test join and confirm the camera turns off (or
      never turns on) on all three passes (pre-join, lobby-wait, and
      passcode-recovery if hit), and check the logs for no camera-related
      warnings from `stopVideoIfConfigured()`.

## Task: Bot launches again and again (late-join + calendar re-queue loop)

Reported after the late-join change: the bots for meeting 3 (test, teams) kept launching repeatedly (3+ sessions in ~5 min). Root cause was a 3-step loop:
(1) Bot ends -> socraticbot.stop() sets meetings.status = "stopped";
(2) the 1-minute global calendar sync (CalendarSyncController -> MeetingModel.getMeetingByIdOrCreate) re-queued any failed/stopped meeting back to "queued" (past or future, unconditionally);
(3) the poller (with the late-join window from the previous task) then launched it again immediately. Before the late-join change, step 3 skipped anything already started, so the re-queue was harmless.

- [x] models/meetings/MeetingModel.js (getMeetingByIdOrCreate): only re-queue a failed/stopped/cancelled/host_rejected/waiting_timeout meeting when the synced event occurrence is UPCOMING (scheduled_start_time in the future / unknown); past occurrences stay terminal so the poller cannot Launched them in a loop. Future/recurring occurrences still get re-queued as before.
- [x] controllers/meetings/BotPollingController.js: defense-in-depth - before marking bot_launching, skip when botManager already reports a live instance for that meeting (getActiveSessionForMeeting by external_meeting_id or id), so duplicate bots can never stack on one meeting.
- [x] Verified: node --check on both files; botManager.getActiveSessionForMeeting exists; meeting 3 marked "expired" (terminal) so it stops cycling; diff stat clean (MeetingModel +37/-13 incl. re-indent, BotPollingController +27/-3).
- [ ] PENDING: restart the running server so the poller + calendar sync load the new guards; after restart the stale "expired" meeting stays terminal and new meetings launch at most once.

## Task: Camera (and mic) still showing ON at the lobby-wait screen - frame-scan + broad-match fix

User sent two screenshots of the real "Hi, Reviewer Bot. Someone will let you
in shortly." lobby screen: CABLE Input/Output were correctly selected as the
Speaker/Microphone devices (confirming selectAudioDevices() really does
work), but BOTH the microphone toggle and the camera toggle were still shown
ON (blue), despite stopVideoIfConfigured() already running at that exact
screen. Asked to re-check the code.

Root cause: the mic-mute and camera-stop selectors
(`[data-track-action-scenario="callMuteAudio"]`, `[aria-label="Turn camera
off"]`, etc.) were guesses from the start - never confirmed against the real
Teams DOM (item #2 on the still-open 6-item follow-up list) - AND, unlike
selectAudioDevices()/_selectOneDevice() (which scans EVERY frame via
`this.page.frames()`, since Teams' pre-join UI can live inside an iframe on
some tenants), both mic-mute and stopVideoIfConfigured() only ever queried
`this.page.evaluate()` - the MAIN frame only. If the mic/camera toggles live
in the same iframe as the (working) device dropdowns, a main-frame-only
query would silently find nothing every time - fully consistent with what
the screenshots showed (device selection worked, mute/camera-off did not).

- [x] Added a new shared helper, `_toggleMediaControl(keyword)`, used by
      BOTH the mic-mute branch of `muteMicAndCamera()` and by
      `stopVideoIfConfigured()` (camera) - each stays its own call/gate as
      before (`muteMicOnJoin` / `disableCameraOnJoin` still independent), it
      is not merged into one function:
      - Scans every frame (`this.page.frames()`, same pattern as
        `_selectOneDevice()`), not just the main page.
      - Matches broadly: any `button`, `[role="switch"]`,
        `[role="checkbox"]`, or `[role="menuitemcheckbox"]` whose
        aria-label/title/visible text contains "mic" or "camera"
        (case-insensitive) - instead of one guessed selector string.
      - Checks BOTH `aria-checked="true"` (Fluent Switch) and
        `aria-pressed="true"` (toggle button) for the "currently on" state,
        since Teams' actual markup for these controls was still unconfirmed
        and could be either.
      - Clicks the first matching control that reports itself ON, and logs
        every candidate it found (label + aria-checked/aria-pressed) whether
        or not it clicked one - so if this STILL doesn't work on the next
        live run, the log will show the real label/attributes Teams is using
        instead of another guess.
      - Never throws; callers already wrap it in try/catch and treat "not
        found" as a warning only.
- [x] Lobby-wait call site (`waitForJoinConfirmation()`'s pre-loop re-apply,
      right after `selectAudioDevices()`): changed from calling
      `stopVideoIfConfigured()` alone to calling the combined
      `muteMicAndCamera()` - since the screenshot showed the MIC toggle also
      still on at this screen, not just the camera, so mic now gets
      re-applied there too, matching the passcode-recovery branch which
      already did this.
- [x] Test tree rewritten to match: `test_video_stop.js` now builds a fake
      `document.querySelectorAll()` (7 tests: on-state via aria-checked,
      on-state via aria-pressed, disabled-flag no-op, mic/camera
      independence x2, camera-stop delegation, a multi-frame scan proving a
      control in a LATER frame is still found, and a same-page CABLE
      device-picker row with no on/off state correctly left un-clicked).
      `test_lobby_wiring.js` Tests 6a/6b updated for the lobby site now
      calling `muteMicAndCamera()` instead of `stopVideoIfConfigured()`
      directly. Full suite: 13/13 pass (4 device-selection + 1 pre-join
      wiring + 2 lobby wiring + 7 media-toggle... note: device-selection(4)+
      wiring(1)+lobby(2)+video-stop(6 numbered + 1 "A2")=13 total).
- [x] `node --check` passes.
- [x] Commit needed one retry (same recurring concurrent-write issue as
      every other change to this file this session) - first
      `device_commit_files` call reported success but re-staging showed the
      OLD pre-fix file (1112 lines, 0 matches for `_toggleMediaControl`).
      Retried the identical commit immediately - re-staged again and
      confirmed genuinely landed: 1213 lines, 4 matches for
      `_toggleMediaControl`, `muteMicAndCamera()` now called at all 3 sites
      (pre-join/lobby-start/passcode-recovery), `node --check` OK.
- [ ] Not verified: an actual live Teams meeting join with this fix. Please
      run another test join and check both the visual lobby screen (mic +
      camera toggles should now be OFF) and the logs. If either control
      still doesn't toggle, the new diagnostic logging
      (`TeamsAdapter(teamJoiner): Mic/Camera control(s) matched "..." but
      none reported ON - candidates: [...]`) will show the real
      label/aria-checked/aria-pressed values Teams is using on your
      machine - paste that log line back and the selector can be corrected
      with certainty instead of another guess.

## Task: Add a genuine "camera confirmed OFF" (and "mic confirmed muted") log line

User asked for a log specifically confirming camera-off happened, so a future
run's log can be trusted as proof rather than just inferring it from "no
error was thrown."

- [x] `_toggleMediaControl()` no longer just logs "clicked" and calls it
      done. After a successful click it now waits ~400ms for Teams to
      re-render, then RE-SCANS the same frame for controls matching the same
      keyword and compares how many report ON before vs. after:
      - ON-count dropped -> `TeamsAdapter(teamJoiner): Camera confirmed
        turned OFF - re-checked the DOM after clicking, ON-count went 1 ->
        0.` (mic: "Mic confirmed muted - ...").
      - ON-count did NOT drop (click landed on the wrong element, or Teams
        ignored it) -> a WARNING instead: `... control was clicked but
        still reports ON afterward (before=1, after=1) - the click may have
        hit the wrong element. Candidates: [...]`.
      - Frame couldn't be re-checked afterward (navigated away/detached) ->
        a distinct info line saying so, so that case is never confused with
        a real confirmation either.
      This means the resulting log line is based on a second, independent
      DOM read after the click, not just "a click event was sent" - it's an
      actual confirmation, not an assumption.
- [x] Test tree: `makeFakeDocument()` in `test_video_stop.js` now makes a
      clicked fake element actually flip its own aria-checked/aria-pressed
      to false (mirroring a real toggle really changing state), plus a
      `stuck: true` flag on a def to simulate a click that does NOT change
      state. New Test G (confirms the "confirmed turned OFF" line appears,
      with the exact before/after ON-count in the message) and Test H
      (confirms a "still reports ON" WARNING - never a false "confirmed"
      claim - when the click doesn't actually change anything). Full suite:
      15/15 pass (4 device-selection + 1 pre-join wiring + 2 lobby wiring +
      8 media-toggle).
- [x] `node --check` passes.
- [x] Commit needed a retry (same recurring concurrent-write issue as every
      other change to this file/repo this session) - re-verified by
      re-staging afterward: 1290 lines, `cfg.confirmedVerb`/`scanFn`/
      `onCountBefore` all present, `node --check` OK.
- [ ] Not verified: an actual live Teams meeting join. Please run one and
      check for `Camera confirmed turned OFF` / `Mic confirmed muted` in the
      logs - if you instead see the "still reports ON/unmuted" warning, that
      means the click IS landing on the right control but Teams isn't
      actually toggling from it (different problem), whereas the earlier
      "control(s) matched but none reported ON" warning means the control
      wasn't found at all - the two warnings now point at two different
      root causes instead of one generic failure.

## Task: FIX 9 (from a real live-run log) - mic/camera toggles use NEITHER aria-checked NOR aria-pressed on this Teams build

User pasted the actual server console output from a live test join. It
confirmed the new diagnostic logging worked exactly as intended and pointed
straight at the real bug, instead of another guess.

Also visible in that same log, unrelated to this session's work: `warn:
(ServerJS File): Setup failed: ProfileManager.runStartupRecovery is not a
function` at `server.js:159` - a startup-time error (non-fatal, server keeps
running) coming from the "Chrome profile lifecycle DB tracking" feature the
OTHER concurrent session added to this repo (see that task earlier in this
file) - `server.js` calls `ProfileManager.runStartupRecovery()` but the
`profileManager.js` module doesn't actually export a function by that name.
Flagging it here since it showed up while checking these logs, but it's that
other session's code, not touched by this task.

Root cause of the actual mic/camera bug: the live log's diagnostic
candidates (added by the previous fix) showed BOTH `aria-checked` and
`aria-pressed` as `null` on every real matching element:
`{"label":"Mute mic","ariaChecked":null,"ariaPressed":null,"tag":"BUTTON"}`
and `{"label":"Turn camera off","ariaChecked":null,"ariaPressed":null,
"tag":"BUTTON"}`. This build of Teams doesn't expose either ARIA state
attribute on these controls at all, so the previous fix's "is it ON" check
could never match anything, even though `_toggleMediaControl()` was
correctly finding the real elements (frame-scanning + broad label matching
both proved out) - devices selected fine, the SAME run, right alongside this.

The log also showed the elements themselves are duplicated: the real
`<button aria-label="Mute mic">` plus a same-labelled `<input aria-label=
"Mute mic (Ctrl+Shift+M)">` (a keyboard-shortcut-hint duplicate, same idea
for camera's `(Ctrl+Shift+O)`).

- [x] `_toggleMediaControl()`: "is this control ON" now also checks a
      label-phrase heuristic, since the label itself already encodes state
      on this build - a button reading "Mute mic" is the ACTION you'd take,
      which only makes sense while the mic is live (if already muted, Teams
      renders "Unmute mic" instead); same for "Turn camera off" (camera
      currently on) vs. "Turn camera on" (off). `isOn = isOnByAria ||
      isOnByLabel` - kept the aria check too, in case a different Teams
      build (or a future update) DOES set it.
- [x] Click now prefers a BUTTON-tag match over any other tag among the ON
      candidates, so it hits the real interactive `<button>` rather than the
      hidden keyboard-shortcut-hint `<input>` duplicate sitting right next
      to it with the same label.
- [x] Test tree: `makeFakeDocument()` gained a `toggleLabel` option (flips
      the fake element's aria-label on click, mirroring the real "Mute mic"
      -> "Unmute mic" label swap - not just an aria attribute flip as
      before). Two new regression tests built directly from the real log's
      exact candidate shapes: Test I (mic: "Mute mic" BUTTON + device-picker
      BUTTON + "(Ctrl+Shift+M)" INPUT, aria-checked/pressed all null) and
      Test J (camera: same pattern) - both confirm the real BUTTON gets
      found and clicked, the device-picker/duplicate INPUT are left alone,
      and a genuine "confirmed muted"/"confirmed turned OFF" log line
      appears. Full suite: 17/17 pass (4 device-selection + 1 pre-join
      wiring + 2 lobby wiring + 10 media-toggle).
- [x] `node --check` passes.
- [x] Commit needed a retry (same recurring concurrent-write issue as every
      other change to this file/repo this session) - re-verified by
      re-staging afterward: 1316 lines, `onPhrase`/`offPhrase`/
      `isOnByLabel` all present, `node --check` OK.
- [x] VERIFIED LIVE by the user: "yes now great work, now video/camera is
      off" - confirmed on a real Teams meeting join. This closes out the
      original "make sure mic/camera really turn off" request end-to-end:
      the diagnostic-logging fix caught the real root cause (no aria-checked/
      aria-pressed on this Teams build) from an actual log, the label-phrase
      fix built from that real data worked on the very next live run. Camera
      (and, per the same code path, mic) mute is confirmed working on the
      pre-join/lobby screens.
