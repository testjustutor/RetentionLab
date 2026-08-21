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
            context.talk_ratio,
            meeting_id=context.meeting_id,
            session_id=context.session_id,
            prompt_output_path=os.path.join(
                context.storage_paths["cache_llm_prompts"],
                f"PROMPT_AUDIT_{context.base_id}.json"
            )
        )

        log_with_type("info", "Engine(task > audit > audit_task) : Evaluation completed", "TASK")

        # Normalize the audit result into a structured rubric payload so the
        # persist_results task can store rubric answers + scores + metrics.
        result = _normalize_audit_result(result)

        log_with_type("info", "Engine(task > audit > audit_task) : Real AI prompt cached by AuditService (system_instruction + rubric + transcript)", "TASK")

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

    except Exception as e:

        context.mark_task_failed(
            "audit"
        )

        log_with_type("error", f"Engine(task > audit > audit_task) : Audit task failed error={str(e)}", "TASK")

        raise


# ==========================================
# STRUCTURED AUDIT RESULT NORMALIZATION
# ==========================================

def _normalize_audit_result(result):
    """
    Convert an audit result dict into a stable structured payload:

        {
            "overall_score": int,
            "max_score": int,
            "percentage": float,
            "rubric": [ {rubric_id, question, answer, score, max_score, evidence} ],
            "metrics": { total_questions, passed, failed, partial }
        }

    Preserves the original oqi_score / category_scores keys so downstream
    consumers (e.g. pythonBridge final response) keep working.
    """
    if not isinstance(result, dict):
        result = {}

    result = dict(result)

    # Surface the gate-failures list returned by the AI (indicator_ids that are
    # gates and scored 0). Downstream persist uses this to flag gate status.
    if not isinstance(result.get("gate_failures"), list):
        result["gate_failures"] = []

    # Extract per-indicator data from the AI response (category_scores).
    rubric = []
    total = passed = failed = partial = 0
    max_score_total = 0
    score_total = 0

    category_scores = result.get("category_scores") or {}
    for category_name, cat_data in category_scores.items():
        if not isinstance(cat_data, dict):
            continue
        indicators = cat_data.get("indicators") or {}
        for ind_name, ind_data in indicators.items():
            if not isinstance(ind_data, dict):
                continue
            raw_score = ind_data.get("score")
            max_val = ind_data.get("max_score", 0)

            # score: null => not scorable (e.g. video-gated indicators with no
            # video feed). MUST be excluded from aggregation, never treated as 0,
            # otherwise it would be double-penalized here and downstream.
            if raw_score is None:
                rubric.append({
                    "rubric_id": ind_data.get("rubric_id") or ind_name,
                    "question": ind_data.get("question") or ind_name,
                    "answer": ind_data.get("answer", ""),
                    "score": None,
                    "max_score": max_val,
                    "evidence": ind_data.get("evidence", ""),
                    "excluded": True
                })
                continue

            total += 1
            max_score_total += max_val or 0
            score_total += float(raw_score or 0)
            if max_val and float(raw_score) >= max_val:
                passed += 1
            elif float(raw_score) and float(raw_score) > 0:
                partial += 1
            else:
                failed += 1
            rubric.append({
                "rubric_id": ind_data.get("rubric_id") or ind_name,
                "question": ind_data.get("question") or ind_name,
                "answer": ind_data.get("answer", ""),
                "score": raw_score,
                "max_score": max_val,
                "evidence": ind_data.get("evidence", "")
            })

    oqi = result.get("oqi_score") or 0
    if not max_score_total:
        max_score_total = 100
    percentage = round((score_total / max_score_total) * 100, 2) if max_score_total else round(float(oqi or 0), 2)

    result["overall_score"] = int(round(oqi)) if oqi else int(round(score_total))
    result["max_score"] = int(max_score_total)
    result["percentage"] = percentage
    result["rubric"] = rubric
    result["metrics"] = {
        "total_questions": total,
        "passed": passed,
        "failed": failed,
        "partial": partial
    }

    return result
