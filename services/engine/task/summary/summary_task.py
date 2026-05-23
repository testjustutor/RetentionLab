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

    try:

        service = SummaryService()

        summary = service.generate(

            context.labeled_transcript
        )

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

        context.summary_path = (
            output_path
        )

        context.mark_task_completed(
            "summary"
        )

    except Exception:

        context.mark_task_failed(
            "summary"
        )

        raise
