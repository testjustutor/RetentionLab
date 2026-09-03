"""
services/engine/__init__.py

AI Engine Root Package.
"""
from .transcriber import transcribe_and_diarize
from .client import AssemblyAIClient
from .pipeline import run_pipeline, __version__
from .resemblyzer_diarizer import ResemblyzerDiarizer

__all__ = [
    "transcribe_and_diarize",
    "AssemblyAIClient",
    "run_pipeline",
    "__version__",
    "ResemblyzerDiarizer",
]