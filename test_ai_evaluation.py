# root/test_ai_evaluation.py
"""
Manual / on-demand mid-pipeline runner for a specific meeting + session.

Unlike test-engine.js (which runs the FULL pipeline: media -> transcription ->
audit/summary -> persist_results), this script starts MID-PIPELINE at the
`audit` stage, using an ALREADY-EXISTING transcript for the session. It runs
the exact same task handlers the orchestrator DAG uses:

    audit            -> services/engine/task/audit_task.py            (oqi_score comes from here)
    summary          -> services/engine/task/summary_task.py
    persist_results  -> services/engine/task/persist_results_task.py  (saves everything to MySQL)

Usage:
    python test_ai_evaluation.py <meetingId> <sessionId>

Both meetingId and sessionId are supplied explicitly on the command line.

IMPORTANT (base_id / cache file naming): this script does NOT invent a
synthetic "MANUAL_AUDIT_..." name. It resolves the REAL recording/session
filename the same way the actual pipeline would (meeting_sessions.audio_file_name,
falling back to the resolved TRANS_*.txt filename with the "TRANS_" prefix
stripped), then feeds that real name into PipelineContext exactly like
engine_main.py does. That means base_id - and every cache file this script
writes (PROMPT_AUDIT_<base_id>.json, AUDIT_<base_id>.json,
SUMMARY_<base_id>.txt) - is IDENTICAL to what a full pipeline run for this
session would have produced, so reruns cleanly overwrite/update the same
files instead of scattering new manual-only artifacts.

A PipelineContext is built in-memory (no media/transcription work happens),
then runs, in order:

    audit_task.run_audit_task(context)
    summary_task.run_summary_task(context)
    persist_results_task.run_persist_results_task(context)

printing the result of each stage. Each stage is isolated in its own
try/except so a failure in one (e.g. AI quota exhausted during audit) does not
prevent the others from running - persist_results gracefully skips whatever
data didn't get produced, and always verifies meeting_id actually exists in
`meetings` before writing (see persist_results_task.py::_meeting_exists).
"""

import argparse
import json
import os
import sys
import traceback

# ==========================================
# PROJECT ROOT + .env (so DB/API keys resolve)
# ==========================================
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = current_dir

if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Load root .env for DB + AI provider keys (best-effort; db/api modules also try).
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(project_root, ".env"))
except Exception:
    pass

from database.python_db import fetch_one

from services.engine.orchestrator.pipeline_context import PipelineContext
from services.engine.task.audit_task import run_audit_task
from services.engine.task.summary_task import run_summary_task
from services.engine.task.persist_results_task import run_persist_results_task, _meeting_exists

STORAGE_DIRS = ["cache_audio_transcripts", "transcripts", "cache_captions_raw", ""]


# ==========================================================
# SESSION / TRANSCRIPT RESOLUTION
# ==========================================================

def resolve_session_row(session_id):
    row = fetch_one(
        "SELECT id, audio_file_name, transcript_file_name FROM meeting_sessions WHERE id = %s LIMIT 1",
        (int(session_id),),
    )
    if not row:
        raise FileNotFoundError(f"No session found for id {session_id} in meeting_sessions")
    return row


def resolve_transcript_path(session_id, session_row):
    """Resolve the transcript path (meeting_assets first, then
    meeting_sessions.transcript_file_name)."""
    asset = fetch_one(
        "SELECT transcript_path FROM meeting_assets WHERE session_id = %s LIMIT 1",
        (int(session_id),),
    )
    return (asset or {}).get("transcript_path") or session_row.get("transcript_file_name")


def resolve_transcript_text(transcript_path, session_id):
    """Read the transcript text from the resolved path, else scan storage for it."""
    candidates = []
    seen = set()

    if transcript_path:
        p = transcript_path if os.path.isabs(transcript_path) else os.path.join(project_root, transcript_path)
        if p not in seen:
            seen.add(p)
            candidates.append(p)

    # Session stem (Sess<N>) to narrow the storage scan, if derivable.
    base = None
    if transcript_path and "Sess" in str(transcript_path):
        import re
        m = re.search(r"Sess(\d+)", str(transcript_path))
        if m:
            base = m.group(1)

    # If the resolved path isn't a file, scan the normal transcript dirs.
    if not any(os.path.isfile(c) for c in candidates):
        for d in STORAGE_DIRS:
            folder = os.path.join(project_root, "storage", d) if d else os.path.join(project_root, "storage")
            if not os.path.isdir(folder):
                continue
            for f in sorted(os.listdir(folder)):
                if f.lower().endswith((".txt", ".json")) and ("TRANS_" in f.upper() or f"Sess{session_id}" in f):
                    if base is None or f"Sess{base}" in f or f"Sess{session_id}" in f:
                        p = os.path.join(folder, f)
                        if p not in seen:
                            seen.add(p)
                            candidates.append(p)

    for c in candidates:
        if os.path.isfile(c):
            with open(c, "r", encoding="utf-8") as fh:
                text = fh.read()
            if text and text.strip():
                return text.strip()

    raise FileNotFoundError("Could not resolve a transcript for this session")


def resolve_real_input_filename(session_row, transcript_path):
    """
    Resolve the REAL recording/session filename the actual pipeline would
    have used as `input_file`, so PipelineContext derives the same base_id
    (and therefore the same cache filenames: WHISPER_<base_id>.json,
    AUDIO_TRANS_<base_id>.txt, PROMPT_AUDIT_<base_id>.json,
    AUDIT_<base_id>.json, SUMMARY_<base_id>.txt, etc.) as a full run would.

    Priority:
      1. meeting_sessions.audio_file_name (authoritative - this is exactly
         what engine_main.py / python_runner.js pass in as input_file).
      2. The resolved transcript filename with a leading "TRANS_" prefix
         stripped (matches PipelineContext._resolve_captions_trans_path's
         own "TRANS_<base_id>.txt" convention, run in reverse).
      3. Last resort: "Sess<N>" so the script never hard-crashes, though
         this path should rarely be hit if DB data is populated normally.
    """
    audio_file_name = session_row.get("audio_file_name")
    if audio_file_name:
        return os.path.basename(str(audio_file_name).replace("\\", "/"))

    if transcript_path:
        fname = os.path.basename(str(transcript_path).replace("\\", "/"))
        if fname.upper().startswith("TRANS_"):
            fname = fname[len("TRANS_"):]
        return fname

    return f"Sess{session_row.get('id')}"


# ==========================================================
# CONTEXT CONSTRUCTION (skips media + transcription entirely)
# ==========================================================

def build_mid_pipeline_context(meeting_id, session_id, input_filename, transcript_text):
    """
    Build a PipelineContext WITHOUT running media/transcription. The context
    only needs what audit_task / summary_task / persist_results_task actually
    read: labeled_transcript, talk_ratio, meeting_id, session_id, base_id,
    storage_paths. Everything else (audio_path, transcript_path, etc.) stays
    at its default/None since those stages never run.

    input_filename is the REAL recording/session filename (see
    resolve_real_input_filename) - NOT a synthetic placeholder - so base_id
    matches what the real pipeline would have derived, and every cache file
    this script writes lines up with the existing naming convention.
    """
    ai_config = {
        "pipeline_features": {
            "media_extraction": False,
            "transcription": False,
            "ai_audit": True,
            "summary_generation": True,
            "persist_results": True,
        }
    }

    context = PipelineContext(
        input_file=input_filename,
        ai_config=ai_config,
        project_root=project_root,
    )

    # Override whatever the constructor auto-resolved from the filename/DB -
    # meeting_id and session_id are supplied explicitly on the command line,
    # so use those directly rather than any filename-regex/DB re-resolution.
    context.meeting_id = int(meeting_id)
    context.session_id = int(session_id)

    # Feed in the transcript directly - this is what would normally come out
    # of the transcription task (context.labeled_transcript).
    context.labeled_transcript = transcript_text
    context.talk_ratio = {}

    return context


# ==========================================================
# MAIN ENTRY: audit -> summary -> persist_results
# ==========================================================

def run_mid_pipeline(meeting_id, session_id):
    print(f"🗂️  Using meeting_id={meeting_id}, session_id={session_id}")

    session_row = resolve_session_row(session_id)

    print("📄 Resolving transcript path/text...")
    transcript_path = resolve_transcript_path(session_id, session_row)
    print(f"   transcript_path={transcript_path or '(scan)'}")
    transcript_text = resolve_transcript_text(transcript_path, session_id)
    print(f"   transcript resolved ({len(transcript_text.split())} words)")

    input_filename = resolve_real_input_filename(session_row, transcript_path)
    print(f"📛 Resolved real input filename: {input_filename}")

    context = build_mid_pipeline_context(meeting_id, session_id, input_filename, transcript_text)
    print(f"🧩 Context built: meeting_id={context.meeting_id}, session_id={context.session_id}, base_id={context.base_id}")

    # Early heads-up if persistence will be skipped later (real meetings.id
    # missing), so it's obvious up front rather than buried after audit/summary run.
    if not _meeting_exists(context.meeting_id):
        print(f"⚠️  WARNING: meeting_id={context.meeting_id!r} not found in `meetings` table - "
              f"persist_results will skip DB writes (audit/summary will still run and be cached to disk).")

    results = {"meeting_id": context.meeting_id, "session_id": context.session_id, "base_id": context.base_id}

    # ---- STAGE 1: audit (oqi_score comes from here) ----
    print("\n🤖 [1/3] Running audit stage...")
    try:
        run_audit_task(context)
        results["audit"] = {
            "success": True,
            "oqi_score": context.audit_results.get("oqi_score"),
            "gate_failures": context.audit_results.get("gate_failures"),
            "audit_json_path": context.audit_json_path,
        }
        print(f"   ✅ audit complete — oqi_score={context.audit_results.get('oqi_score')}")
    except Exception as e:
        results["audit"] = {"success": False, "error": str(e)}
        print(f"   ❌ audit failed: {e}")
        traceback.print_exc()

    # ---- STAGE 2: summary ----
    print("\n📝 [2/3] Running summary stage...")
    try:
        run_summary_task(context)
        results["summary"] = {
            "success": True,
            "summary_path": context.summary_path,
        }
        print(f"   ✅ summary complete — saved to {context.summary_path}")
    except Exception as e:
        results["summary"] = {"success": False, "error": str(e)}
        print(f"   ❌ summary failed: {e}")
        traceback.print_exc()

    # ---- STAGE 3: persist_results (saves everything to MySQL) ----
    print("\n💾 [3/3] Running persist_results stage...")
    try:
        run_persist_results_task(context)
        results["persist_results"] = {
            "success": True,
            "task_status": context.task_status.get("persist_results"),
        }
        print(f"   ✅ persist_results complete — status={context.task_status.get('persist_results')}")
    except Exception as e:
        results["persist_results"] = {"success": False, "error": str(e)}
        print(f"   ❌ persist_results failed: {e}")
        traceback.print_exc()

    results["execution_metadata"] = context.execution_metadata
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run audit -> summary -> persist_results for an explicit "
                     "meeting_id + session_id, using its existing transcript "
                     "and REAL recording filename (skips media/transcription)."
    )
    parser.add_argument("meeting_id", help="Numeric meetings.id")
    parser.add_argument("session_id", help="Numeric meeting_sessions.id")
    args = parser.parse_args()

    try:
        result = run_mid_pipeline(args.meeting_id, args.session_id)
        print("\n==================================================")
        print("✅ RUN COMPLETE")
        print("==================================================")
        print(json.dumps(result, indent=2, default=str))

        # Non-zero exit if any stage failed, so CI/scripts can detect it.
        failed = any(
            isinstance(v, dict) and v.get("success") is False
            for k, v in result.items()
            if k in ("audit", "summary", "persist_results")
        )
        sys.exit(1 if failed else 0)
    except Exception as e:
        print(f"\n❌ RUN FAILED: {e}")
        traceback.print_exc()
        sys.exit(1)