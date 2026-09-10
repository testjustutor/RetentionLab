# root/audit_bridge.py

"""
Standalone CLI: run the full media -> transcription -> audit pipeline for a
single recording (no session_id required).

FIX: this file used to construct MediaService(ROOT) / TranscriptionService()
directly and call media.extract_audio(...) / transcriber.process(...). Those
methods/signatures don't exist anymore - MediaService and TranscriptionService
were refactored to take a shared PipelineContext and expose
.process(input_file) / .transcribe(audio_path) instead, so every call in the
old version of this file raised AttributeError/TypeError the moment it ran.
Nothing in the current codebase invokes this script (confirmed via a repo-wide
search), so the bug was silent, but it's fixed here by going through the same
PipelineContext + PipelineRunner orchestrator that services/engine/engine_main.py
(the live Node-bridge entry point) and test_ai_evaluation.py already use -
guaranteeing this matches the current, working engine API instead of a stale
one.
"""

import sys
import os
import json
import subprocess

# ==========================================================
# 1. PROJECT ROOT SETUP (same as engine_main.py)
# ==========================================================
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# ==========================================================
# 2. AUTO-DEPENDENCY MANAGER
# ==========================================================
REQUIRED_PACKAGES = [
    "openai-whisper",
    "moviepy",
    "torch",
    "torchaudio",
    "requests",
    "numpy"
]

def install_missing_packages():
    """Checks for missing packages and installs them automatically."""
    for package in REQUIRED_PACKAGES:
        try:
            import_name = package.replace("-", "_")
            if package == "openai-whisper":
                import_name = "whisper"
            __import__(import_name)
        except ImportError:
            print(f"[*] Package '{package}' not found. Installing...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])

# Run the installer before importing our AI services
install_missing_packages()

# ==========================================================
# 3. CORE ENGINE IMPORTS - context-based, matches engine_main.py
# ==========================================================
from services.engine.orchestrator.pipeline_context import PipelineContext
from services.engine.orchestrator.pipeline_runner import PipelineRunner

ROOT = os.path.dirname(os.path.abspath(__file__))


def execute_pipeline(video_name, meeting_id=None):
    """
    Full audit pipeline: Media -> Transcription -> AI Audit (with DB storage
    when meeting_id resolves to a real meetings.id).

    Args:
        video_name: The recording file name (e.g. REC_xxx.mp4), resolved
            under storage/recordings/ (same convention as the Node bridge).
        meeting_id: The meeting ID for storing audit results in the database.
            Coerced/validated by PipelineContext; persist_results_task.py
            already skips DB writes cleanly (with a logged warning) if it
            doesn't resolve to a real row, so it's safe to pass through as-is.
    """
    try:
        video_path = os.path.join(ROOT, "storage", "recordings", video_name)

        # Verify video exists before starting
        if not os.path.exists(video_path):
            print(f"ERROR|File not found: {video_path}")
            return

        if meeting_id:
            print(f"[Audit Bridge] Using meeting_id={meeting_id}")
        else:
            print("[Audit Bridge] WARNING: meeting_id not provided. Audit results will NOT be stored in DB.")

        # Media + transcription + audit only (no summary) - persist_results
        # stays enabled since it already no-ops safely when meeting_id is
        # missing/unresolvable.
        ai_config = {
            "meeting_id": meeting_id,
            "pipeline_features": {
                "media_extraction": True,
                "transcription": True,
                "ai_audit": True,
                "summary_generation": False,
                "persist_results": True,
            },
        }

        context = PipelineContext(
            input_file=video_name,
            ai_config=ai_config,
            project_root=ROOT,
        )

        runner = PipelineRunner(context)

        print("[1/3] Extracting audio...")
        print("[2/3] Running transcription...")
        print("[3/3] Generating quality audit...")

        result = runner.execute()

        transcript_path = result.get("transcript_path") or context.transcript_path
        audit_path = result.get("audit_json_path") or context.audit_json_path

        # The SUCCESS prefix is what the Node.js audit.js route looks for
        print(f"SUCCESS|{transcript_path}|{audit_path}")

    except Exception as e:
        print(f"ERROR|Pipeline failed: {str(e)}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("ERROR|No video filename provided.")
        print("Usage: python audit_bridge.py <video_name> [meeting_id]")
        sys.exit(1)

    video_name = sys.argv[1]
    meeting_id = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] not in ('None', '') else None

    execute_pipeline(video_name, meeting_id=meeting_id)
