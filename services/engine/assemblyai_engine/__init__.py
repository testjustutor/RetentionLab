"""
services/engine/assemblyai_engine
=================================

AssemblyAI SDK wrapper within the consolidated engine.

Entry point: python -m services.engine.assemblyai_engine.main <audio_path> [opts_json]
"""
from .transcriber import transcribe_and_diarize
from .client import AssemblyAIClient

__all__ = ["transcribe_and_diarize", "AssemblyAIClient"]
__version__ = "1.0.0"