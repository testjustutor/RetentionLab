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
