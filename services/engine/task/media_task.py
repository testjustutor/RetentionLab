import os

from services.engine.media_service import (
    MediaService
)


def run_media_task(context):

    """
    Handles:
    - recording validation
    - ffmpeg extraction
    - wav generation
    - media cache creation
    """

    context.mark_task_started(
        "media"
    )

    try:

        recording_full_path = os.path.join(
            context.storage_paths["recordings"],
            context.input_file
        )

        print(
            "\n"
            + "=" * 65,
            flush=True
        )

        print(
            "[MEDIA TASK] Starting media extraction pipeline...",
            flush=True
        )

        print(
            "=" * 65 + "\n",
            flush=True
        )

        media_service = MediaService(
            context.project_root
        )

        audio_path = media_service.extract_audio(
            recording_full_path
        )

        context.audio_path = audio_path

        context.mark_task_completed(
            "media"
        )

        print(
            "[MEDIA TASK] Audio extraction completed.\n",
            flush=True
        )

    except Exception:

        context.mark_task_failed(
            "media"
        )

        raise