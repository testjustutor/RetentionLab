# root/services/engine/task/audit/audit_task.py

from utils.logger_util import log_with_type

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

    log_with_type("info", "Engine(task > audit > audit_task) : Audit task started", "TASK")

    try:

        service = AuditService()

        log_with_type("info", "Engine(task > audit > audit_task) : AuditService initialized", "TASK")

        result = service.evaluate(

            context.labeled_transcript,

            context.talk_ratio
        )

        log_with_type("info", "Engine(task > audit > audit_task) : Evaluation completed", "TASK")

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

        log_with_type("info", "Engine(task > audit > audit_task) : Prompt cached", "TASK")

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

        log_with_type("info", f"Engine(task > audit > audit_task) : Audit saved path={output_path}", "TASK")

        context.audit_json_path = (
            output_path
        )

        context.audit_results = (
            result
        )

        context.mark_task_completed(
            "audit"
        )

        log_with_type("info", "Engine(task > audit > audit_task) : Audit task completed", "TASK")

    except Exception:

        context.mark_task_failed(
            "audit"
        )

        log_with_type("error", f"Engine(task > audit > audit_task) : Audit task failed error={str(e)}", "TASK")

        raise
