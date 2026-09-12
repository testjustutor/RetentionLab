# services/engine/task/transcription_task.py

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

        # FIX: Whisper must run on the extracted/normalized 16kHz mono WAV
        # (wav_audio_path), not context.audio_path - the latter is now the
        # canonical recording path (storage/recordings/REC_...) that gets
        # persisted to meeting_assets.audio_path, and used to be (wrongly)
        # the WAV cache path.
        result = service.transcribe(
            context.wav_audio_path
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Whisper transcription completed", "TASK")

        # FIX: context.transcript_path is the CANONICAL transcript path
        # persisted to meeting_assets.transcript_path - it must stay
        # storage/transcripts/TRANS_... (the platform captions transcript
        # already resolved onto context.captions_trans_path in
        # PipelineContext). Previously this line overwrote it with the
        # Whisper-generated cache file (storage/cache_audio_transcripts/
        # AUDIO_TRANS_...), so the DB ended up pointing at a cache file
        # instead of the real transcript. That cache path is kept separately
        # as whisper_transcript_cache_path (used as a fallback only when no
        # platform captions transcript could be found, e.g. admin-uploaded
        # recordings with no live captions).
        context.whisper_transcript_cache_path = (
            result["transcript_path"]
        )

        context.transcript_path = (
            context.captions_trans_path
            or result["transcript_path"]
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

    # FIX: was `except Exception:` with `str(e)` in the log line below -
    # `e` was never bound, so a real transcription failure raised a
    # NameError here instead, and the ORIGINAL error/traceback was lost.
    except Exception as e:

        context.mark_task_failed(
            "transcription"
        )

        log_with_type("error", f"Engine(task > transcription > transcription_task) : Transcription failed error={str(e)}", "TASK")

        raise