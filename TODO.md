# TODO

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
