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

transcribe_and_diarize / AssemblyAIClient used to be re-exported here for
services/engine/services/diarization_engine.py's optional AssemblyAI
diarization backend. That backend was never reachable in the live pipeline
(transcription_task.py only ever calls .transcribe(), never .diarize()), and
services/engine/transcriber.py + its client.py/config.py/main.py support
files have since been removed as orphaned code - they referenced
services/engine/pipeline.py, which was deleted in an earlier cleanup pass.
diarization_engine.py now always builds the fallback, per-segment mapping
and no longer imports either name. The re-exports below were left behind by
that cleanup and made every engine run fail at import time (package
__init__.py always executes first), so they're removed here too.
"""

__all__ = []