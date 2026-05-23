import os

from services.engine.media_service.service import (
    MediaService
)


def run_media_task(context):

    """
    Media preprocessing task.

    Responsibilities:
    - validate recording
    - extract wav audio
    - normalize audio
    - store wav cache
    """

    context.mark_task_started(
        "media"
    )

    try:

        print(
            "\n[MEDIA TASK] Starting media processing...",
            flush=True
        )

        service = MediaService(
            context
        )

        result = service.process(
            context.input_file
        )

        context.audio_path = result[
            "audio_path"
        ]

        context.mark_task_completed(
            "media"
        )

        print(
            "[MEDIA TASK] Completed.\n",
            flush=True
        )

    except Exception:

        context.mark_task_failed(
            "media"
        )

        raise