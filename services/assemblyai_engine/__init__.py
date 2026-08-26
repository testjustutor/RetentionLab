"""
services/assemblyai_engine
===========================

Isolated AssemblyAI SDK wrapper. Does NOT import from services.engine or
services.python_engine - fully standalone, callable from any outer page
either directly in Python or via runner.js from Node.

Entry point: python -m services.assemblyai_engine.main <audio_path> [opts_json]
"""
from .transcriber import transcribe_and_diarize
from .client import AssemblyAIClient

__all__ = ["transcribe_and_diarize", "AssemblyAIClient"]
__version__ = "1.0.0"