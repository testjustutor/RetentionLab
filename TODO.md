# TODO

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
