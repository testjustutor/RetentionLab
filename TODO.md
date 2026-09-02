- [x] COMPLETED: meeting_session_scores FK fix verified. TutorEvaluationService._resolve_admin_indicator_ids dynamically maps master rubric_indicators.id -> admin_rubric_indicators.id (meeting owner -> created_by admin -> same-company admin fallback), no hardcoded ids. Live check: meetings 2/3/4 -> owner 5 -> created_by 2 -> 94 admin copies. Score loop writes admin_indicator_id and skips indicators with no admin copy. py_compile clean.

# TODO — Remove `meeting_scores` table usage (replaced by `meeting_session_scores`)

## Context
The `meeting_scores` table (migration 033) has been removed and replaced by
`meeting_session_scores` (migration 034). All models/controllers that still
reference `meeting_scores` must point at `meeting_session_scores`.

- [x] Add this TODO file
- [x] `models/reviews/MeetingScoresModel.js` — upsert + getScoresByMeeting
- [x] `controllers/reviewers/reviewersController.js` — pass session_id in scoreUpsert
- [x] `models/rubrics/RubricModel.js` — saveMeetingScores + getMeetingReport
- [x] `controllers/scores/scoresController.js` — bulkSave passes session_id
- [x] `models/rubrics/RubricAdminModel.js` — getMeetingReportWithAdmin + calculateAdminWeightedScore
- [x] `models/settings/MeetingSettingsModel.js` — totalReviews count
- [x] `models/settings/OrganizationModel.js` — totalScores count
- [x] Dead inline SQL: `reviewerReviewsController.js`, `reviewerSessionsController.js`, `reviewController.js`
- [x] Verify — node syntax check on all edited files
- [x] Stale comments updated: `auditReportController.js`, `reports/auditReportController.js`, `reviewController.js`

## Notes
- No runtime SQL references `meeting_scores` anymore. Remaining hits are non-runtime:
  - Endpoint/method names for the meeting-level session-score APIs (`get_meeting_scores`,
    `delete_meeting_scores` in `app.py`, `routes/session_scores.py`,
    `controllers/python/python_session_scores_controller.py`) — names only, not table references。
  - `database/manual-seeder/12_seed_meeting_scores.js` — orphan dev seeder that
    inserts into the dropped `meeting_scores` table. It is not wired into the runtime;
    the current session-score seeder is `13_seed_meeting_session_scores.js`. Consider
    deleting `12_seed_meeting_scores.js` (kept out of scope for this fix).
  - `project_structure_only.txt` — historical structure listing./docs。
  - `database/migrations/033...` no longer exists (removed by the user;, ensuring the
    `meeting_scores` table is never created).

# TODO — services/engine: keep only current-flow modules, remove dead code

## Context
The `services/engine` folder accumulated a lot of modules that are NOT part of the
current runtime flow. Verified via static import-graph analysis + manual inspection.

### Real entry points (current flow)
- `engine_main.py` — invoked by Node bridge (`services/shared/pythonBridge.js`
  `runFullAudioPipeline` -> `runStage('engine_main.py', ...)`), used by
  `services/socraticbot.js` and `test-engine.js`.
- `audit_bridge.py` (project root) — used by `controllers/audit/auditController.js`.
- `services/engine/manual/run_diarization.py` + `run_tutor_evaluation.py` — documented
  on-demand scripts (ARCHITECTURE.md).
- `test_ai_evaluation.py` (root) — test harness.

### Main pipeline graph
media -> transcription -> (audit + summary in parallel) -> persist_results
(registry: orphan empty task_registry / dependency_graph)

## Plan
- [x] Keep only the reachable modules (verified import-graph: 39 modules used by
      `engine_main`, `audit_bridge` services, and `test_ai_evaluation`).
- [x] Remove unused sub-folders entirely: `cache/`, `dashboard/`, `distributed/`,
      `intelligence/`, `live/`, `logging/`, `prompts/`, `quality/`, `runtime/`
- [x] Remove unused files inside kept packages (unused `media_service/*`,
      `orchestrator/engine_main.py|pipeline_bootstrap.py|pipeline_runtime.py|runtime_state_manager.py`,
      unused `shared/*`, unused `transcription_service/*`, orphan root-level `task/*.py`, etc.)
- [x] Clean up stale `__pycache__`
- [x] Verify imports (`python -m compileall` clean; registry loads 5 tasks; task modules import)
- [x] Verify no remaining .py/.js references outside engine point at removed modules

## Follow-up (this session)
- [x] Removed `services/engine/manual/` entirely (`run_diarization.py`, `run_tutor_evaluation.py`).
- [x] Flattened `services/engine/task/`: moved all files from `task/{audit,media,persist,
      summary,transcription}/` directly into `task/` and removed the sub-folders.
      Updated imports in `orchestrator/task_registry.py` and `task/transcription_task.py`
      (`services.engine.task.<module>` instead of `services.engine.task.<pkg>.<module>`).
- [x] Re-verified: `compileall` clean, all 5 registry tasks resolve, task modules import, no stale refs.

# TODO — Merge WhisperXEngine / python_engine / assemblyai_engine into services/engine

## Context
Consolidate 4 areas into ONE main folder `services/engine`:
  - services/engine (existing monolith)
  - services/python_engine (Whisper + Resemblyzer + WhisperX + AssemblyAI)
  - services/assemblyai_engine (standalone AssemblyAI)
  - WhisperXEngine (part of python_engine)

Chosen strategy (user): keep old module paths / JS runner requires working via
thin compatibility shims; move real code into services/engine. "Less folder
structure" + file-location headers at top of each file.

## Entry points to preserve (shims)
- engine_main.py          -> spawned by services/shared/pythonBridge.js
- services.python_engine.main / video_convert  -> spawned by python_engine/runner.js
- services.assemblyai_engine.main              -> spawned by assemblyai_engine/runner.js
- audit_bridge.py (root) -> imports services.engine.*
- test_ai_evaluation.py  -> imports services.engine.ai_evaluation_service

## Plan
- [ ] Move python_engine real code -> services/engine/python_engine (+ shim at old path)
- [ ] Move assemblyai_engine real code -> services/engine/assemblyai_engine (+ shim at old path)
- [ ] Dedupe the two AssemblyAI implementations into one canonical module
- [ ] Update file-location headers (root-relative) on every moved file
- [ ] Verify: python -m compileall + import tests for all entry points + runner.js paths

# TODO — Remove pyannote from the whole project

## Context
The user wants pyannote removed entirely from the project (no `pyannote.audio`,
no whisperx-pyannote diarization).

## Plan
- [x] Deleted `services/engine/transcription_service/pyannote_diarizer.py`
- [x] `services/engine/transcription_service/diarization_engine.py` — removed the
      pyannote `_try_pyannote` backend + HF-token logic; kept AssemblyAI + fallback;
      changed `"source": "pyannote_diarization"` -> `"diarization"`
- [x] `audit_bridge.py` — removed `"pyannote.audio"` from `REQUIRED_PACKAGES`
- [x] `diarization_engine.py`/`speaker_resolver.py`/`service.py` — removed pyannote
      from docstrings/comments
- [x] `services/python_engine/whisperx_engine.py` — removed the whisperx
      `DiarizationPipeline` (pyannote) step, the now-unused `_assign_speakers`, and
      the dead `self.hf_token`; kept transcription + alignment + `_apply_role_labels`
      (still used by `pipeline.py`)
- [x] Docs cleaned: `ARCHITECTURE.md`, `README.md`, `project_structure_only.txt`,
      `services/python_engine/__init__.py`, `TODO.md`
- [x] Verified: no `pyannote` references remain project-wide; `compileall` exit 0;
      `diarization_engine`, `service`, `whisperx_engine`, and `pipeline` all import.