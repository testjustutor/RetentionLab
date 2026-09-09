# services/engine/task/tutor_eval_task.py

from utils.logger_util import log_with_type

import os

from services.engine.services.tutor_eval_worker import (
    TutorEvaluationService,
    TutorEvaluationError,
)
from services.shared.ai_config import load_settings_ai, build_ai_config


def run_tutor_eval_task(context):

    context.mark_task_started("tutor_eval")

    log_with_type("info", "Engine(task > tutor_eval > tutor_eval_task) : Tutor eval task started", "TASK")

    try:

        # TutorEvaluationService needs an ai_config (unlike AuditService,
        # which builds its own AiClient internally) - build it the same way
        # ai_audit.py / summary.py do.
        try:
            ai_settings = load_settings_ai()
        except Exception:
            ai_settings = {}

        ai_config = build_ai_config(ai_settings)

        if not ai_config:
            raise TutorEvaluationError("AI config could not be built - check provider settings")

        if not context.session_id:
            raise TutorEvaluationError(
                f"session_id could not be resolved from filename base_id={context.base_id!r} - "
                "tutor evaluation requires a valid session_id"
            )

        service = TutorEvaluationService(ai_config)

        # Shared prompt-cache file: SAME path audit_task.py writes its own
        # "audit" section into (both tasks build this path from
        # context.base_id), so the two AI evaluations that run for this
        # session land in ONE file instead of two separate ones.
        prompt_output_path = os.path.join(
            context.storage_paths["cache_llm_prompts"],
            f"PROMPT_{context.base_id}.json",
        )

        result = service.generate_evaluation(
            context.labeled_transcript,
            session_id=context.session_id,
            meeting_id=context.meeting_id,
            prompt_output_path=prompt_output_path,
        )

        context.tutor_eval_results = result

        context.mark_task_completed("tutor_eval")

        log_with_type("info", "Engine(task > tutor_eval > tutor_eval_task) : Tutor eval task completed", "TASK")

    except Exception as e:

        context.mark_task_failed("tutor_eval")

        log_with_type("error", f"Engine(task > tutor_eval > tutor_eval_task) : Tutor eval task failed error={str(e)}", "TASK")

        raise