# services/engine/task/media_task.py

from utils.logger_util import log_with_type

import os

from services.engine.services.media import (
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

    log_with_type("info", "Engine(task > media > media_task) : Media task started", "TASK")

    try:

        service = MediaService(
            context
        )

        log_with_type("info", "Engine(task > media > media_task) : MediaService initialized", "TASK")

        result = service.process(
            context.input_file
        )

        log_with_type("info", "Engine(task > media > media_task) : Media processing completed", "TASK")

        context.audio_path = result[
            "audio_path"
        ]

        log_with_type("info", f"Engine(task > media > media_task) : Audio path set={context.audio_path}", "TASK")

        context.mark_task_completed(
            "media"
        )
        log_with_type("info", "Engine(task > media > media_task) : Media task completed", "TASK")

    except Exception as e:

        context.mark_task_failed(
            "media"
        )

        log_with_type("error", f"Engine(task > media > media_task) : Media task failed error={str(e)}", "TASK")

        raise