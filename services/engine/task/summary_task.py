# services/engine/task/summary_task.py

from utils.logger_util import log_with_type

import os

from services.engine.services.summary import (
    SummaryService
)

from services.engine.services.file_store import (
    FileStore
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

        # Build a structured summary payload (summary + key_points + action_items)
        # so the persist_results task can store it to MySQL.
        if isinstance(summary, dict):
            context.summary_data = summary
            summary_text = summary.get("summary", "")
            key_points = summary.get("key_points", [])
            action_items = summary.get("action_items", [])
        else:
            summary_text = summary or ""
            key_points = []
            action_items = []
            context.summary_data = {
                "summary": summary_text,
                "key_points": key_points,
                "action_items": action_items
            }

        # Save the summary text file for downstream/asset use
        output_path = os.path.join(

            context.storage_paths[
                "summaries"
            ],

            f"SUMMARY_{context.base_id}.txt"
        )

        FileStore.save_text(

            output_path,

            summary_text
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
