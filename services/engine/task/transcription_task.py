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

from services.engine.transcript_validation import (
    validate_transcript
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

        # ==========================================
        # PRE-AUDIT TRANSCRIPT VALIDATION
        # Detect an empty/near-empty or single-speaker-only session BEFORE
        # the audit task spends an LLM call on it. The single-speaker check
        # needs the platform CAPTIONS transcript (real speaker names) - the
        # live Whisper path never attaches speaker labels at all - so it's
        # read here (best-effort; a missing/unreadable file just means the
        # single-speaker check is skipped, not assumed).
        # ==========================================
        captions_text = None

        if context.captions_trans_path and os.path.exists(context.captions_trans_path):
            try:
                with open(context.captions_trans_path, "r", encoding="utf-8") as captions_file:
                    captions_text = captions_file.read()
            except Exception as read_err:
                log_with_type(
                    "warning",
                    f"Engine(task > transcription > transcription_task) : Could not read captions transcript for validation path={context.captions_trans_path} error={str(read_err)}",
                    "TASK",
                )

        validation = validate_transcript(
            context.labeled_transcript,
            captions_text=captions_text,
            talk_ratio=context.talk_ratio,
        )

        if not validation["valid"]:
            context.processing_skipped = True
            context.skip_reason = validation["reason"]
            context.skip_message = validation["message"]

            log_with_type(
                "info",
                f"Engine(task > transcription > transcription_task) : Downstream AI processing will be skipped reason={validation['reason']}",
                "TASK",
            )

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