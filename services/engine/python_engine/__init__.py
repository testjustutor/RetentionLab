"""
services/engine/python_engine
============================

Consolidated Whisper (speech-to-text) + Resemblyzer (speaker diarization)
pipeline, merged into the single services/engine folder.

  * only depends on standard scientific libs + Whisper + Resemblyzer;
  * degrades gracefully: if Resemblyzer is unavailable it still returns
    Whisper transcription with a single "SPEAKER_00" diarization track, so a
    Node bridge can always consume well-formed JSON.

Entry point: python -m services.engine.python_engine.main <audio_path> [ai_settings_json]
"""
import os
import sys

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
    
from .pipeline import run_pipeline, __version__

__all__ = ["run_pipeline", "__version__"]