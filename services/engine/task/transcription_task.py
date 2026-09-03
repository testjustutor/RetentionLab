# root/services/engine/task/transcription/transcription_task.py

from utils.logger_util import log_with_type

import os

from services.engine.services.json_store import (
    JsonStore
)

from services.engine.task.cache_manager import (
    TranscriptionCacheManager
)

from services.engine.services.transcription import (
    TranscriptionService
)


def run_transcription_task(context):

    context.mark_task_started(
        "transcription"
    )
    log_with_type("info", "Engine(task > transcription > transcription_task) : Transcription task started", "TASK")

    try:

        service = TranscriptionService(
            context
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : TranscriptionService initialized", "TASK")

        result = service.transcribe(
            context.audio_path
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Whisper transcription completed", "TASK")

        context.transcript_path = (
            result["transcript_path"]
        )

        context.labeled_transcript = (
            result["transcript"]
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Context updated with plain transcript", "TASK")

        context.whisper_path = (
            TranscriptionCacheManager.save_whisper_output(
                context,
                result["whisper_result"]
            )
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Whisper output cached", "TASK")

        context.mark_task_completed(
            "transcription"
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Transcription task completed", "TASK")

    except Exception:

        context.mark_task_failed(
            "transcription"
        )
        
        log_with_type("error", f"Engine(task > transcription > transcription_task) : Transcription failed error={str(e)}", "TASK")

        raise