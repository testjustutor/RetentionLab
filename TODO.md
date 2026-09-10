# TODO

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
