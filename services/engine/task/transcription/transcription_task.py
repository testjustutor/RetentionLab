import os

from services.engine.shared.json_store import (
    JsonStore
)

from services.engine.task.transcription.cache_manager import (
    TranscriptionCacheManager
)

from services.engine.transcription_service.service import (
    TranscriptionService
)


def run_transcription_task(context):

    """
    Full WhisperX transcription pipeline.
    """

    context.mark_task_started(
        "transcription"
    )

    try:

        print(
            "\n[TRANSCRIPTION TASK] Starting...",
            flush=True
        )

        service = TranscriptionService(
            context
        )

        result = service.transcribe(
            context.audio_path
        )

        context.transcript_path = (
            result["transcript_path"]
        )

        context.labeled_transcript = (
            result["transcript"]
        )

        context.diarization_data = (
            result["diarization"]
        )

        context.talk_ratio = (
            result["talk_ratio"]
        )

        context.whisper_path = (
            TranscriptionCacheManager.save_whisper_output(
                context,
                result["whisper_result"]
            )
        )

        diarization_path = os.path.join(
            context.storage_paths[
                "cache_diarization"
            ],
            f"DIAR_{context.base_id}.json"
        )

        JsonStore.save(
            diarization_path,
            context.diarization_data
        )

        talk_ratio_path = os.path.join(
            context.storage_paths[
                "cache_voice_activity"
            ],
            f"RATIO_{context.base_id}.json"
        )

        JsonStore.save(
            talk_ratio_path,
            context.talk_ratio
        )

        context.diarization_path = (
            diarization_path
        )

        context.talk_ratio_path = (
            talk_ratio_path
        )

        context.captions_raw_path = (
            TranscriptionCacheManager.save_raw_captions(
                context,
                context.diarization_data
            )
        )

        JsonStore.save(
            os.path.join(
                context.storage_paths[
                    "cache_chat_logs"
                ],
                f"CHAT_{context.base_id}.json"
            ),
            {
                "messages": [],
                "source": "offline_test_engine",
                "status": "not_captured",
                "reason": "node test-engine.js processes a recording file and does not join a live meeting chat."
            }
        )

        JsonStore.save(
            os.path.join(
                context.storage_paths[
                    "cache_screenshots"
                ],
                f"SCREENSHOTS_{context.base_id}.json"
            ),
            {
                "screenshots": [],
                "source": "offline_test_engine",
                "status": "not_captured",
                "reason": "node test-engine.js does not open a browser session, so no screenshots are produced."
            }
        )

        context.mark_task_completed(
            "transcription"
        )

        print(
            "[TRANSCRIPTION TASK] Completed.\n",
            flush=True
        )

    except Exception:

        context.mark_task_failed(
            "transcription"
        )

        raise
