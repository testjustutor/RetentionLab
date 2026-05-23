# Test Engine Process Flow

This document explains which files are used when running this command:

```powershell
node test-engine.js .\storage\recordings\REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3
```

## 1. Command Entry

```text
PowerShell
`-- node test-engine.js .\storage\recordings\REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3
```

Main file:

```text
test-engine.js
```

What it does:

- Loads environment variables with `dotenv`.
- Initializes and seeds the database through `database/db.js`.
- Reads the audio path from the command line.
- Converts the path to only the file name:
  `REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3`
- Calls `PythonBridge.runFullAudioPipeline(fileName)`.
- Prints success or failure in the terminal.

## 2. Database Initialization

```text
test-engine.js
`-- database/db.js
    `-- database/rubricSeeder.js
```

Purpose:

- Ensures required database tables exist.
- Seeds rubric data before the pipeline starts.
- Uses `retention_lab.db`.

## 3. Node To Python Bridge

```text
test-engine.js
`-- services/shared/pythonBridge.js
```

Important method:

```text
PythonBridge.runFullAudioPipeline(fileName)
```

What it does:

- Extracts meeting ID from the recording file name.
- Loads AI and runtime settings from `config/settings.js`.
- Builds a JSON config payload.
- Calls `runStage('engine_main.py', [fileName, configJson])`.
- Spawns the Python engine.
- Parses the final JSON printed by Python.
- Updates meeting asset records with generated paths.

Python executable selection:

```text
PYTHON_EXECUTABLE env var
`-- active VIRTUAL_ENV python
    `-- .venv/Scripts/python.exe
        `-- fallback: python
```

This matters because the Python used by Node must have packages like `openai-whisper` installed.

## 4. Python Engine Entry

```text
services/shared/pythonBridge.js
`-- services/engine/engine_main.py
```

`engine_main.py` receives:

```text
input_file      = REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3
ai_settings_json = JSON string from config/settings.js
```

What it does:

- Computes `project_root`.
- Creates `PipelineContext`.
- Creates `PipelineRunner`.
- Executes the pipeline.
- Prints final JSON for Node to parse.

## 5. Runtime Context

```text
services/engine/engine_main.py
`-- services/engine/orchestrator/pipeline_context.py
```

`PipelineContext` stores:

- Input file name.
- Project root.
- Meeting/base ID.
- Storage/cache paths.
- Feature flags.
- Runtime task status.
- Generated output paths.

For this input:

```text
input_file = REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3
base_id    = viu-weqt-ecv_Sess23_2026-05-08_11-10
```

Storage paths created/used:

```text
storage/recordings
storage/cache_wav_audio
storage/cache_audio_transcripts
storage/cache_diarization
storage/cache_voice_activity
storage/cache_audits
storage/summaries
storage/intel
```

## 6. Pipeline Orchestration

```text
services/engine/engine_main.py
`-- services/engine/orchestrator/pipeline_runner.py
    |-- services/engine/orchestrator/execution_manager.py
    |-- services/engine/orchestrator/dependency_graph.py
    |-- services/engine/orchestrator/task_registry.py
    `-- services/engine/orchestrator/runtime_manager.py
```

Execution rules:

```text
media
`-- transcription
    |-- intel      optional, parallel
    |-- audit      optional, parallel
    |-- summary    optional, parallel
    `-- topics     optional, parallel
```

Feature flags come from:

```text
config/settings.js
```

Current settings:

```text
media_extraction   -> media task
transcription      -> transcription task
intel_extraction   -> intel task
ai_audit           -> audit task
summary_generation -> summary task
topic_clustering   -> topics task
```

With the current config, the main test path is:

```text
media -> transcription
```

The other tasks only run if their feature flags are enabled.

## 7. Media Task

```text
services/engine/orchestrator/task_registry.py
`-- services/engine/task/media/media_task.py
    `-- services/engine/media_service/service.py
        |-- services/engine/media_service/file_validator.py
        |-- services/engine/media_service/audio_extractor.py
        `-- services/engine/media_service/audio_normalizer.py
```

What it does:

- Resolves the relative input file name under:
  `storage/recordings`
- Validates that the recording exists.
- Uses FFmpeg to extract/convert audio.
- Normalizes the WAV audio.
- Stores the final audio path on `context.audio_path`.

Input:

```text
storage/recordings/REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3
```

Output:

```text
storage/cache_wav_audio/NORM_viu-weqt-ecv_Sess23_2026-05-08_11-10.wav
```

## 8. Transcription Task

```text
services/engine/orchestrator/task_registry.py
`-- services/engine/task/transcription/transcription_task.py
    `-- services/engine/transcription_service/service.py
        |-- services/engine/transcription_service/whisper_loader.py
        |-- services/engine/transcription_service/whisper_runner.py
        |-- services/engine/transcription_service/diarization_engine.py
        `-- services/engine/transcription_service/transcript_builder.py
```

What it does:

- Loads a Whisper model through `whisper_loader.py`.
- Runs transcription through `whisper_runner.py`.
- Runs diarization placeholder/engine through `diarization_engine.py`.
- Builds transcript output through `transcript_builder.py`.
- Stores transcript, diarization data, and talk ratio on `PipelineContext`.

Important dependency:

```text
openai-whisper
```

The Python executable used by Node must be able to run:

```powershell
python -c "import whisper; print('ok')"
```

## 9. Optional Parallel Tasks

These run after transcription only when enabled in `config/settings.js`.

### Intel

```text
services/engine/task/intel/intel_task.py
```

Typical output:

```text
storage/intel
storage/cache_embeddings
```

### Audit

```text
services/engine/task/audit/audit_task.py
`-- services/engine/ai_audit_service/service.py
```

Typical output:

```text
storage/cache_audits/AUDIT_<base_id>.json
```

### Summary

```text
services/engine/task/summary/summary_task.py
`-- services/engine/summary_service/service.py
```

Typical output:

```text
storage/summaries/SUMMARY_<base_id>.txt
```

### Topics

```text
services/engine/task/topics/topics_task.py
```

Typical output:

```text
storage/cache_topic_trackers
```

## 10. Final Python Response

```text
PipelineRunner.execute()
`-- PipelineContext.build_final_response()
```

The final JSON includes:

```json
{
  "success": true,
  "meeting_id": "viu-weqt-ecv_Sess23_2026-05-08_11-10",
  "audio_path": "storage/cache_wav_audio/...",
  "transcript_path": "storage/cache_audio_transcripts/...",
  "sentiment_path": null,
  "vector_path": null,
  "audit_json_path": null,
  "summary_path": null,
  "oqi_score": 0
}
```

Node reads this JSON from stdout.

## 11. Asset Database Update

```text
services/shared/pythonBridge.js
`-- models/MeetingAssetsModel.js
```

What it does:

- Initializes meeting asset records.
- Saves generated artifact paths.
- Marks status as `Completed` or `Error`.

## 12. End-To-End File Chain

```text
test-engine.js
|-- database/db.js
|   `-- database/rubricSeeder.js
|-- config/settings.js
|-- services/shared/pythonBridge.js
|   `-- models/MeetingAssetsModel.js
`-- services/engine/engine_main.py
    |-- services/engine/orchestrator/pipeline_context.py
    |-- services/engine/orchestrator/pipeline_runner.py
    |-- services/engine/orchestrator/execution_manager.py
    |-- services/engine/orchestrator/dependency_graph.py
    |-- services/engine/orchestrator/task_registry.py
    |-- services/engine/orchestrator/runtime_manager.py
    |-- services/engine/task/media/media_task.py
    |   `-- services/engine/media_service/
    |-- services/engine/task/transcription/transcription_task.py
    |   `-- services/engine/transcription_service/
    |-- services/engine/task/intel/intel_task.py
    |-- services/engine/task/audit/audit_task.py
    |-- services/engine/task/summary/summary_task.py
    `-- services/engine/task/topics/topics_task.py
```

## 13. Common Failure Points

```text
Missing recording
`-- Check storage/recordings/<file_name>

Wrong Python executable
`-- Check [Bridge Python Executable] in logs

Missing whisper package
`-- Run .\.venv\Scripts\python.exe -c "import whisper; print('ok')"

Stale test lock
`-- Remove .test-engine.lock only when no test process is running

Long transcription runtime
`-- Large audio files can take several minutes depending on Whisper model and CPU/GPU
```
