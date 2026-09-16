# CLAUDE.md — Instructions for AI Assistants Working on RetentionLab

This file is the entry point for any AI coding assistant (Claude, or others) working
in this repository. Read it before making changes. It complements — and does not
replace — `.clinerules` (the project's own rule file, still binding) and
`README.md` (setup and run commands). Where this file and `.clinerules` overlap,
they agree; this file adds architecture context and lessons learned that
`.clinerules` doesn't cover.

## 1. What this project is

RetentionLab (marketed internally as "ZoomBot.ai") is a Node.js/Express + MySQL
web application that joins Zoom, Google Meet, and Microsoft Teams meetings as a
bot, captures live captions/audio, transcribes and diarizes the recording, and
runs an AI pipeline that evaluates tutor performance against a rubric (an
"AI audit"), alongside a human reviewer workflow that does the same evaluation
manually. It has a dashboard UI for admins, super-admins, instructors,
reviewers, and students, each with their own views under `public/<role>/`.

It is **not** a PHP project, even though it lives under `C:\xampp\htdocs\`. It runs
as its own Node process on port 3000 (see `README.md` for the reasons XAMPP/Apache
can't just serve it, and for the optional reverse-proxy setup).

## 2. High-level architecture

```
Browser (public/*.html + public/js/*.js)
   -> Routes (routes/*.js, routes/<role>/*.js)
   -> Controllers (controllers/<module>/*Controller.js)
   -> Models (models/<module>/*Model.js)
   -> database/db.js (MySQL)
```

This is the MVC chain mandated by `.clinerules`: HTML -> JavaScript -> Routes ->
Controllers -> Models -> Database. Do not skip layers (no SQL in controllers, no
model calls from routes, no business logic in routes, no inline JS/CSS in HTML).

### The Python AI engine (separate subsystem)

Recording processing and AI evaluation run in Python, invoked from Node:

```
services/shared/pythonBridge.js (Node)
   -> spawns services/engine/engine_main.py (Python)
        -> services/engine/orchestrator/* (task DAG)
             - PipelineContext, PipelineRunner, ExecutionManager,
               DependencyGraph, RuntimeManager, TaskRegistry
        -> dispatches to services/engine/task/*
             - media_task -> transcription_task (sequential)
             - audit_task + summary_task (run in parallel after transcription)
             - persist_results_task (sequential, last)
```

See `services/engine/task/README.md` for the authoritative description of this
execution model — read it before touching task ordering or dependencies.

Business logic underneath the tasks lives in `services/engine/services/*.py`
(media extraction, diarization, transcription, summarization) and in
`services/engine/audit_service.py` / `audit_storage.py` / `audit_scoring.py`
(the AI-audit scoring pipeline — see section 4, this is a known trouble spot).

### Platform adapters

`services/platforms/{zoom,google-meet,teams}/` each implement bot join, caption
capture, participant tracking, and audio/video recording for that platform,
behind a common interface (`services/platforms/platformFactory.js`). Shared
recording/join logic lives directly under `services/platforms/`.

### Bot orchestration

`services/shared/botManager.js` manages bot lifecycle (launch, monitor,
shutdown) across platforms; `services/shared/browserManager.js` and
`profileManager.js` handle the underlying browser automation (this app drives a
real/headless browser to join meetings, it does not use official meeting-bot
APIs).

### Deepgram transcription (separate, active feature)

`services/python_deepgram/` (`main.py`, `transcriber.py`, `name_detector.py`,
`participants_repo.py`, `runner.js`) is a **separate, actively developed**
transcription + speaker-name-detection path using the Deepgram API, gated on
`DEEPGRAM_API_KEY`. `runner.js` exports `transcribeWithDeepgram` and
`deepgramAvailable`. `requirements.txt` documents it as live functionality.

**As of this writing, no caller of `runner.js`'s exports was found** in
`pythonBridge.js`, `botManager.js`, or the controllers checked
(`participantsController.js`, `recordingsController.js`,
`videoRecordingsController.js`). This is an open question, not a conclusion —
see section 5's warning before assuming this folder is unused.

## 3. Database

MySQL (`retention_lab` database). Schema lives entirely in
`database/migrations/*.js` (numbered, sequential) and is seeded from
`database/seeders/*.js`. `npm run db:init` / `db:migrate` / `db:seed` set it up
(see `README.md`). Always check the actual migration files for a table's real
columns before writing or changing a query — do not assume from a model's name
what columns exist.

## 4. Known trouble spot: duplicate/legacy scoring implementations

This codebase has a recurring failure pattern worth naming explicitly: **the
same scoring math has been implemented more than once**, and the copies drift
out of sync. This already caused one real, shipped bug (fixed 2026-09-16, see
`TODO.md` and the project doc `retentionlab-ai-audit-scoring-fix.md` for full
detail):

- **Canonical AI-audit scoring** (correct, weight-based): `compute_category_score`
  and `compute_weighted_overall` in `services/engine/audit_scoring.py`, used by
  `audit_service.py` and `audit_storage.py`. Category scores are weighted by
  each category's configured `weight` (falling back to 1 if unset/zero) —
  matching the manual-reviewer path in
  `controllers/reviewer/tutorEvaluationController.js`
  (`computeCategoryScore`/`computeFinalScore`).
- **Legacy, criteria-count-based scoring** (the old, wrong version, replicating a
  documented bug from `review_calculation_logic.txt`):
  `compute_category_score_from_counts` and `compute_overall_from_category_rows`,
  also still in `audit_scoring.py`. These weight each category's contribution to
  the overall score by how many rubric criteria it happened to have, not by its
  configured importance — so a category with more line items could silently
  dominate the score regardless of its actual weight. `audit_storage.py` still
  computes an informational-only `category_rows_by_count` /
  `total_weighted_percent` using this old math for two DB columns that are kept
  for backward compatibility — do not use those columns as the "real" score.
  The dead callers of this legacy path (`services/engine/services/ai_audit.py`,
  `audit_worker.py`, and root `audit_bridge.py`) were deleted on 2026-09-16
  after being confirmed unreferenced.

**If you are asked to touch AI-audit scoring, or the numbers look wrong**: check
which of these two function pairs is actually being called before changing
anything. Do not add a third implementation — extend `audit_scoring.py`'s
canonical functions and update every caller.

`review_calculation_logic.txt` at the repo root documents three known
discrepancies between the submit-time and update-time scoring flows. Two are
already resolved/confirmed-dead (the `calc_source="update"` branch has no live
caller; `red_flag` handling was verified consistent across both flows in
`tutorEvaluationController.js`). The weight-vs-count issue above was the one
still live, and is now fixed going forward (existing historical rows were
**not** backfilled — that was an explicit scope decision, not an oversight).

## 5. Critical lesson: audit/inventory docs in this repo go stale — verify before acting

The repo root has several `.txt` files that look authoritative but are
point-in-time snapshots, not live truth:

- `unused_files_pythonBridge_flow.txt` — a dead-code audit. Its own "Scope
  note" explicitly says it only covers the `pythonBridge.js -> engine_main.py`
  call path and does **not** claim project-wide unused status. During this
  session, this file's claim that `services/python_deepgram/` was unused was
  **wrong** — that folder is actively developed (files modified after the audit
  was written, documented as live in `requirements.txt`, a real working
  feature). Always independently verify a "this is dead code" claim against
  current file mtimes, `requirements.txt`, and actual grep-for-callers before
  deleting anything, even when a doc says it's safe.
- `pythonBridge_flow_functions.txt`, `video_processing_flow_functions.txt`,
  `review_calculation_logic.txt`, `IMPROVEMENT_PROMPT_TEMPLATE.txt` — similar
  point-in-time analysis/reference docs. Treat their factual claims about
  "current" behavior as hypotheses to verify, not facts.
- `project_structure_only.txt` — a generated directory listing. It is
  regenerated by running `.\generate_structure.ps1` (PowerShell, repo root;
  also exposed as `npm run structure:update`). **Run this after any structural
  change** (new files/folders, deletions, renames). This file was found stale
  during this session (still listing three files that had been deleted, plus
  several other nonexistent entries) and was manually corrected on 2026-09-16
  by cross-checking the live filesystem directory-by-directory — the fact that
  this could happen and go unnoticed is itself the lesson: nothing here should
  be trusted without a live check if it's being used to justify an irreversible
  action like a deletion.

**Rule of thumb: any file in this repo whose name suggests it documents
"what's used", "what's unused", or "the structure of" the codebase is a
snapshot. Confirm its claims against the live code (grep for real callers,
check `git log`/mtimes for recent activity, check `requirements.txt`/
`package.json` for declared dependencies) before relying on it, especially
before deleting anything.**

## 6. Development workflow (from `.clinerules` — still binding)

- Always create/update `TODO.md` before and during a task, with `[ ]`/`[x]`
  checkboxes. Work one task at a time; verify and test each one before moving
  to the next.
- Explain significant changes before implementing them.
- Preserve existing project structure unless explicitly told otherwise.
- Follow the MVC chain (section 2) strictly: no business logic in routes, no
  direct model calls from routes, no raw SQL in controllers, no inline JS/CSS
  in HTML, no API calls directly from HTML (only from the page's own JS file).
- Use centralized CSS (`public/css/shared.css`, `colors.css`) and centralized
  reusable components (tables, date filters, dropdown filters, pagination) —
  don't build one-off versions.
- Name new APIs after the page/module they serve; keep naming consistent with
  existing routes.
- Don't search folders excluded by `.gitignore`.
- Don't modify unrelated code; keep changes isolated to the requested feature.

## 7. Testing / verification commands

From `README.md` (verify these still work as documented — they were current as
of 2026-09-16):

```powershell
# Python engine import sanity check
python -c "import services.engine.engine_main as m; print('import_ok')"

# Node syntax check for a specific file
node --check services\platforms\google-meet\monitor.js

# Run the AI pipeline against a stored recording (auto-resolves from DB by session id)
node test-engine.js <meeting_sessions.id>

# Run AI tutor evaluation for a session id
.\.venv\Scripts\python.exe test_ai_evaluation.py <meeting_sessions.id>

# Refresh project_structure_only.txt after structural changes
.\generate_structure.ps1
```

There is no automated test suite (no `npm test` beyond these manual scripts) —
"verify before marking a task complete" in `.clinerules` means running the
relevant script above and/or manually exercising the changed feature, not
relying on CI.

## 8. Things intentionally left open (do not assume these are resolved)

- Whether to backfill historical AI-audit scores computed under the old
  criteria-count formula — explicitly deferred, not decided.
- The dead `calc_source="update"` code branch in the scoring flow — confirmed
  unreachable, not yet removed.
- What (if anything) currently calls into `services/python_deepgram/runner.js`
  — genuinely unresolved; do not delete or refactor that folder based on an
  assumption that it's unused.
- No end-to-end runtime smoke test of the full pipeline has been performed in
  an automated way — verification has relied on the manual scripts in section 7
  plus code-level unit checks of scoring math.

## 9. When in doubt

Re-read `.clinerules` for process rules, `README.md` for how to run and test
things, `services/engine/task/README.md` for the AI pipeline's execution
model, and section 5 above before trusting any "inventory" document in this
repo. When a claim about the codebase (a comment, a doc, a variable name)
disagrees with what a live grep or a fresh directory listing shows, the live
check wins.
