import os

from services.engine.ai_audit_service.service import (
    AuditService
)

from services.engine.shared.json_store import (
    JsonStore
)


def run_audit_task(context):

    context.mark_task_started(
        "audit"
    )

    try:

        service = AuditService()

        result = service.evaluate(

            context.labeled_transcript,

            context.talk_ratio
        )

        JsonStore.save(
            os.path.join(
                context.storage_paths[
                    "cache_llm_prompts"
                ],
                f"PROMPT_AUDIT_{context.base_id}.json"
            ),
            {
                "task": "audit",
                "provider": "local-fallback",
                "transcript_characters": len(
                    context.labeled_transcript or ""
                ),
                "talk_ratio": context.talk_ratio or {},
                "prompt_template": "Evaluate transcript quality using rubric-style domain scoring."
            }
        )

        output_path = os.path.join(

            context.storage_paths[
                "cache_audits"
            ],

            f"AUDIT_{context.base_id}.json"
        )

        JsonStore.save(
            output_path,
            result
        )

        context.audit_json_path = (
            output_path
        )

        context.audit_results = (
            result
        )

        context.mark_task_completed(
            "audit"
        )

    except Exception:

        context.mark_task_failed(
            "audit"
        )

        raise
