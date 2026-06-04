# root/services/engine/task/summary/summary_task.py

from utils.logger_util import log_with_type

import os

from services.engine.summary_service.service import (
    SummaryService
)

from services.engine.shared.file_store import (
    FileStore
)

from services.engine.shared.json_store import (
    JsonStore
)


def run_summary_task(context):

    context.mark_task_started(
        "summary"
    )

    log_with_type("info", "Engine(task > summary > summary_task) : Summary task started", "TASK")

    try:

        service = SummaryService()

        log_with_type("info", "Engine(task > summary > summary_task) : SummaryService initialized", "TASK")

        summary = service.generate(
            context.labeled_transcript
        )

        log_with_type("info", "Engine(task > summary > summary_task) : Summary generated", "TASK")

        JsonStore.save(
            os.path.join(
                context.storage_paths[
                    "cache_llm_prompts"
                ],
                f"PROMPT_SUMMARY_{context.base_id}.json"
            ),
            {
                "task": "summary",
                "provider": "local-fallback",
                "transcript_characters": len(
                    context.labeled_transcript or ""
                ),
                "prompt_template": "Generate a concise meeting summary from the transcript."
            }
        )

        log_with_type("info", "Engine(task > summary > summary_task) : Prompt cached", "TASK")

        output_path = os.path.join(

            context.storage_paths[
                "summaries"
            ],

            f"SUMMARY_{context.base_id}.txt"
        )

        FileStore.save_text(

            output_path,

            summary
        )

        log_with_type("info", f"Engine(task > summary > summary_task) : Summary saved path={output_path}", "TASK")

        context.summary_path = (
            output_path
        )

        context.mark_task_completed(
            "summary"
        )

        log_with_type("info", "Engine(task > summary > summary_task) : Summary task completed", "TASK")

    except Exception:

        context.mark_task_failed(
            "summary"
        )

        log_with_type("error", f"Engine(task > summary > summary_task) : Summary task failed error={str(e)}", "TASK")

        raise
