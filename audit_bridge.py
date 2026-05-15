import sys
import subprocess
import os
import json

# ==========================================================
# 1. AUTO-DEPENDENCY MANAGER
# ==========================================================
REQUIRED_PACKAGES = [
    "openai-whisper",
    "moviepy",
    "pyannote.audio",
    "torch",
    "torchaudio",
    "requests",
    "numpy"
]

def install_missing_packages():
    """Checks for missing packages and installs them automatically."""
    for package in REQUIRED_PACKAGES:
        try:
            # We use __import__ to check if the package is available
            # Note: package names in pip sometimes differ from import names
            import_name = package.replace("-", "_")
            if package == "openai-whisper": import_name = "whisper"
            
            __import__(import_name)
        except ImportError:
            print(f"[*] Package '{package}' not found. Installing...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])

# Run the installer before importing our AI services
install_missing_packages()

# ==========================================================
# 2. CORE ENGINE IMPORTS
# ==========================================================
from services.engine.media_service import MediaService
from services.engine.pipeline_service import PipelineService
from services.engine.audit_service import AuditService

# Your Hugging Face Token (Required for Diarization)
HF_TOKEN = "YOUR_HF_TOKEN" 
ROOT = os.path.dirname(os.path.abspath(__file__))

def execute_pipeline(video_name):
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
        pipeline = PipelineService(HF_TOKEN)
        auditor = AuditService()

        # 1. Media (MP4 -> WAV)
        print("[1/3] Extracting audio...")
        audio_path = media.extract_audio(video_path)

        # 2. Transcription (AI Processing)
        print("[2/3] Running AI Transcription & Diarization...")
        transcript_text = pipeline.process(audio_path)
        
        # Ensure transcript directory exists
        os.makedirs(os.path.dirname(transcript_path), exist_ok=True)
        with open(transcript_path, "w", encoding="utf-8") as f: 
            f.write(transcript_text)

        # 3. Audit (Rubric Scoring)
        print("[3/3] Generating Quality Audit...")
        report = auditor.run_audit(transcript_text)
        
        # Ensure audits directory exists
        os.makedirs(os.path.dirname(audit_path), exist_ok=True)
        with open(audit_path, "w", encoding="utf-8") as f: 
            json.dump(report, f, indent=4)

        # The SUCCESS prefix is what the Node.js audit.js route looks for
        print(f"SUCCESS|{transcript_path}|{audit_path}")

    except Exception as e:
        print(f"ERROR|Pipeline failed: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        execute_pipeline(sys.argv[1])
    else:
        print("ERROR|No video filename provided.")