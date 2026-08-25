"""
services/python_engine
======================

Isolated, self-contained Whisper (speech-to-text) + Resemblyzer (speaker
diarization) pipeline. This package lives UNDER its own top-level folder and:

  * does NOT import anything from ``services.engine`` (the legacy monolithic
    engine), so it can never conflict with the existing pyannote/whisperx
    pipeline module names or registry;
  * only depends on standard scientific libs + Whisper + Resemblyzer;
  * degrades gracefully: if Resemblyzer is unavailable it still returns
    Whisper transcription with a single "SPEAKER_00" diarization track, so a
    Node bridge can always consume well-formed JSON.

Entry point: python -m services.python_engine.main <audio_path> [ai_settings_json]
"""
from .pipeline import run_pipeline, __version__

__all__ = ["run_pipeline", "__version__"]