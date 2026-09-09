"""
services/engine/__init__.py

AI Engine Root Package.

NOTE: this used to also re-export run_pipeline (pipeline.py) and
ResemblyzerDiarizer (resemblyzer_diarizer.py) - the standalone admin
video-processing engine that videoProcessingController.js called before it
converged onto the same pythonBridge.js -> engine_main.py pipeline Flow 1
(the meeting bot) uses. Those two modules (and their exclusive helpers) are
no longer imported by anything, so the re-exports were removed here too -
leaving them would have made importing ANY services.engine.* submodule
(which engine_main.py does on every run) fail once pipeline.py is deleted,
since Python always executes a package's __init__.py first.

transcribe_and_diarize / AssemblyAIClient are kept: they're still used as an
optional AssemblyAI diarization backend by
services/engine/services/diarization_engine.py (with a graceful fallback to
non-diarized segments if unavailable).
"""
from .transcriber import transcribe_and_diarize
from .client import AssemblyAIClient

__all__ = [
    "transcribe_and_diarize",
    "AssemblyAIClient",
]