# root/test_ai_evaluation.py
"""
Manual / on-demand AI Tutor Session Evaluation for a specific session — session-id driven.

Usage:
    python test_ai_evaluation.py <sessionId>

It looks up meeting_sessions.id in MySQL, resolves the meeting id + transcript
(auto from meeting_assets.transcript_path, else meeting_sessions.transcript_file_name,
else a storage scan for a matching TRANS_*.txt), then runs TutorEvaluationService
(category + overall percentages, persists to MySQL, caches the prompt/response in
storage/cache_llm_prompts/EVAL_<...>.json).

Compare: services/engine/manual/run_tutor_evaluation.py (flag-based), this mirrors
the "just pass a session id" style of test-engine.js.
"""

import argparse
import json
import os
import re
import sys

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
from services.shared.ai_config import load_settings_ai, build_ai_config
from services.engine.services import TutorEvaluationService

STORAGE_DIRS = ["cache_audio_transcripts", "transcripts", "cache_captions_raw", ""]


# ==========================================================
# SESSION RESOLUTION (just like test-engine.js resolves ids)
# ==========================================================

def resolve_session(session_id):
    """Return (meeting_id, transcript_path) for a session, or raise if missing."""
    session = fetch_one(
        "SELECT id, meeting_id, transcript_file_name FROM meeting_sessions WHERE id = %s LIMIT 1",
        (int(session_id),),
    )
    if not session:
        raise FileNotFoundError(f"No session found for id {session_id} in meeting_sessions")

    meeting_id = session.get("meeting_id")

    # meeting_assets is the authoritative transcript path (joined by its session_id).
    asset = fetch_one(
        "SELECT transcript_path FROM meeting_assets WHERE session_id = %s LIMIT 1",
        (int(session_id),),
    )
    transcript_path = (asset or {}).get("transcript_path") or session.get("transcript_file_name")
    return meeting_id, transcript_path


def resolve_transcript_text(transcript_path):
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
                if f.lower().endswith((".txt", ".json")) and "TRANS_" in f.upper():
                    if base is None or f"Sess{base}" in f:
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


def run_ai_evaluation(session_id):
    print(f"🗂️  Resolving session {session_id}...")
    meeting_id, transcript_path = resolve_session(session_id)
    print(f"   meeting_id={meeting_id}, transcript_path={transcript_path or '(scan)'}")

    print("🗄️  Loading AI config...")
    ai_settings = load_settings_ai()
    ai_config = build_ai_config(ai_settings)
    if not ai_config:
        raise RuntimeError("No usable AI provider/key configured in config/settings.js")

    print("📄 Resolving transcript text...")
    transcript = resolve_transcript_text(transcript_path)

    base = f"{meeting_id or session_id}_Sess{session_id}"
    prompt_dir = os.path.join(project_root, "storage", "cache_llm_prompts")
    os.makedirs(prompt_dir, exist_ok=True)
    prompt_output_path = os.path.join(prompt_dir, f"EVAL_{base}.json")

    svc = TutorEvaluationService(ai_config)
    print("🤖 Running AI tutor session evaluation...")
    result = svc.generate_evaluation(
        transcript_text=transcript,
        session_id=int(session_id),
        meeting_id=int(meeting_id) if meeting_id else None,
        prompt_output_path=prompt_output_path,
    )
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run on-demand AI Tutor Session Evaluation from a session id.")
    parser.add_argument("session_id", help="Numeric meeting_sessions.id")
    args = parser.parse_args()

    try:
        result = run_ai_evaluation(args.session_id)
        print("\n✅ AI EVALUATION COMPLETE: SUCCESS")
        print(json.dumps(result, indent=2, default=str))
    except Exception as e:
        print(f"\n❌ AI EVALUATION FAILED: {e}")
        sys.exit(1)