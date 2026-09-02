# root/audit_bridge.py

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
# 3. CORE ENGINE IMPORTS
# ==========================================================
from services.engine.media_service.service import MediaService
from services.engine.transcription_service.service import TranscriptionService
from services.engine.ai_audit_service.service import AuditService

ROOT = os.path.dirname(os.path.abspath(__file__))


def execute_pipeline(video_name, meeting_id=None):
    """
    Full audit pipeline: Media -> Transcription -> AI Audit (with DB storage).

    Args:
        video_name: The recording file name (e.g. REC_xxx.mp4)
        meeting_id: The meeting ID for storing audit results in the database
    """
    try:
        base_name = video_name.replace("REC_", "TRANS_").replace(".mp4", "")

        # Setup Paths
        video_path = os.path.join(ROOT, "storage", "recordings", video_name)
        transcript_path = os.path.join(ROOT, "storage", "transcript", f"{base_name}.txt")
        audit_path = os.path.join(ROOT, "storage", "audits", f"{base_name}.json")

        # Verify video exists before starting
        if not os.path.exists(video_path):
            print(f"ERROR|File not found: {video_path}")
            return

        # Initialize Services
        media = MediaService(ROOT)
        transcriber = TranscriptionService()
        auditor = AuditService()

        # 1. Media (MP4 -> WAV)
        print("[1/3] Extracting audio...")
        audio_path = media.extract_audio(video_path)

        # 2. Transcription (AI Processing)
        print("[2/3] Running AI Transcription & Diarization...")
        transcript_text = transcriber.process(audio_path)

        # Ensure transcript directory exists
        os.makedirs(os.path.dirname(transcript_path), exist_ok=True)
        with open(transcript_path, "w", encoding="utf-8") as f:
            f.write(transcript_text)

        # 3. Audit (Rubric Scoring) — loads rubric and stores results in DB
        print("[3/3] Generating Quality Audit...")
        if meeting_id:
            print(f"[Audit Bridge] Using meeting_id={meeting_id}")
        else:
            print("[Audit Bridge] WARNING: meeting_id not provided. Audit results will NOT be stored in DB.")

        report = auditor.run_audit(
            transcript_text,
            meeting_id=meeting_id
        )

        # Ensure audits directory exists
        os.makedirs(os.path.dirname(audit_path), exist_ok=True)
        with open(audit_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=4)

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