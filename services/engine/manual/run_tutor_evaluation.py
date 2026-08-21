# root/services/engine/manual/run_tutor_evaluation.py
"""
Manual / on-demand AI Tutor Session Evaluation for a specific session.

Engine-side generator (no UI page). Loads the rubric criteria, asks the AI to
rate each criterion as Met / Not Met / Not Applicable from the transcript,
computes category + overall percentages in code, persists ratings + summary +
red-flag to MySQL, and stores the EXACT prompt + EXACT AI response in
storage/cache_llm_prompts/EVAL_<id>.json.

Usage:

    python services/engine/manual/run_tutor_evaluation.py --session_id=159 \
        --meeting_id=4 --transcript_path=storage/cache_audio_transcripts/AUDIO_TRANS_xxx.txt

    # Or pass the transcript inline:
    python services/engine/manual/run_tutor_evaluation.py --session_id=159 \
        --meeting_id=4 --transcript_text="Hello testing..."
"""

import argparse
import json
import os
import sys

# ==========================================
# PROJECT ROOT SETUP (same as engine_main.py)
# ==========================================
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "..", "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from services.shared.ai_config import load_settings_ai, build_ai_config
from services.engine.ai_evaluation_service import TutorEvaluationService

STORAGE_DIRS = ["cache_audio_transcripts", "transcripts", "cache_captions_raw", ""]


def resolve_transcript(transcript_path, transcript_text):
    """Return transcript text from path or inline text."""
    if transcript_text and transcript_text.strip():
        return transcript_text.strip()

    candidates = []
    if transcript_path:
        candidates.append(
            transcript_path if os.path.isabs(transcript_path)
            else os.path.join(project_root, transcript_path)
        )
    else:
        # Try to discover any transcript for the given session in common dirs
        for d in STORAGE_DIRS:
            base = os.path.join(project_root, "storage", d) if d else os.path.join(project_root, "storage")
            if not os.path.isdir(base):
                continue
            for f in sorted(os.listdir(base)):
                if f.lower().endswith((".txt", ".json")) and "TRANS_" in f.upper():
                    candidates.append(os.path.join(base, f))

    for c in candidates:
        if os.path.isfile(c):
            with open(c, "r", encoding="utf-8") as fh:
                return fh.read()

    raise FileNotFoundError("Could not resolve a transcript (provide --transcript_path or --transcript_text)")


def run_tutor_evaluation(session_id, meeting_id=None, transcript_path=None, transcript_text=None, prompt_output_path=None):
    ai_settings = load_settings_ai()
    ai_config = build_ai_config(ai_settings)
    if not ai_config:
        raise RuntimeError("No usable AI provider/key configured in config/settings.js")

    if not prompt_output_path:
        base = f"{meeting_id or session_id}_Sess{session_id}"
        prompt_dir = os.path.join(project_root, "storage", "cache_llm_prompts")
        os.makedirs(prompt_dir, exist_ok=True)
        prompt_output_path = os.path.join(prompt_dir, f"EVAL_{base}.json")

    transcript = resolve_transcript(transcript_path, transcript_text)

    svc = TutorEvaluationService(ai_config)
    return svc.generate_evaluation(
        transcript_text=transcript,
        session_id=int(session_id),
        meeting_id=int(meeting_id) if meeting_id else None,
        prompt_output_path=prompt_output_path,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run on-demand AI Tutor Session Evaluation.")
    parser.add_argument("--meeting_id", default=None, help="Numeric meetings.id")
    parser.add_argument("--session_id", required=True, help="Numeric meeting_sessions.id")
    parser.add_argument("--transcript_path", default=None, help="Path to a transcript file")
    parser.add_argument("--transcript_text", default=None, help="Inline transcript text")
    parser.add_argument("--prompt_output_path", default=None, help="Override prompt/response cache file path")

    args = parser.parse_args()

    result = run_tutor_evaluation(
        session_id=args.session_id,
        meeting_id=args.meeting_id,
        transcript_path=args.transcript_path,
        transcript_text=args.transcript_text,
        prompt_output_path=args.prompt_output_path,
    )
    print(json.dumps(result))
