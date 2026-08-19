# root/services/engine/task/persist/persist_results_task.py
"""
Persist results task.

Runs AFTER summary, audit and topics have completed and persists the
structured results (summary text + rubric answers + scores + metrics)
into MySQL via database/python_db.py.

Pipeline contract:

    media
      -> transcription
         -> [summary + audit + topics]   (parallel)
         -> persist_results              (this task)
         -> complete
"""

from utils.logger_util import log_with_type

import json

from database.python_db import execute


def run_persist_results_task(context):
    """Persist structured pipeline results to MySQL."""
    context.mark_task_started("persist_results")
    log_with_type("info", "Engine(task > persist > persist_results_task) : Persist results task started", "TASK")

    try:
        meeting_id = context.meeting_id or context.base_id
        session_id = context.session_id

        # 1. PERSIST SUMMARY (structured)
        summary_data = getattr(context, "summary_data", None) or {}
        if summary_data:
            _persist_summary(context, meeting_id, session_id, summary_data)

        # 2. PERSIST AUDIT RUBRIC RESULTS + METRICS
        audit_results = context.audit_results or {}
        if audit_results:
            _persist_audit(context, meeting_id, session_id, audit_results)

        log_with_type("info", "Engine(task > persist > persist_results_task) : Persist results task completed", "TASK")
        context.mark_task_completed("persist_results")

    except Exception as e:
        context.mark_task_failed("persist_results")
        log_with_type("error", f"Engine(task > persist > persist_results_task) : Persist results task failed error={str(e)}", "TASK")
        raise


def _persist_summary(context, meeting_id, session_id, summary_data):
    """Upsert structured summary into MySQL (meeting_assets.summary_path)."""
    if not isinstance(summary_data, dict):
        summary_data = {"summary": str(summary_data)}

    summary_text = summary_data.get("summary", "")

    execute(
        """INSERT INTO meeting_assets (meeting_id, session_id, summary_path, status, processed_at)
           VALUES (%s, %s, %s, 'Completed', CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE summary_path = VALUES(summary_path), status = 'Completed', processed_at = CURRENT_TIMESTAMP""",
        (meeting_id, session_id, getattr(context, "summary_path", None) or f"SUMMARY_{context.base_id}.txt")
    )
    log_with_type("info", f"Engine(task > persist) : Summary persisted for meeting={meeting_id} chars={len(summary_text or '')}", "TASK")


def _persist_audit(context, meeting_id, session_id, audit_results):
    """Persist rubric answers + scores + metrics into MySQL."""
    if session_id is None:
        log_with_type("info", "Engine(task > persist) : session_id is None, skipping audit persistence", "TASK")
        return

    # session_rubric_summary - aggregate metrics row (session_id based)
    overall_score = audit_results.get("overall_score") or audit_results.get("oqi_score") or 0
    percentage = audit_results.get("percentage") or overall_score
    gate_status = "all_passed"
    if audit_results.get("metrics", {}).get("failed", 0) > 0:
        gate_status = "gate_failed"

    execute(
        """INSERT INTO session_rubric_summary (session_id, weighted_score_pct, gate_status, overall_rating, confidence_level)
           VALUES (%s, %s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE
             weighted_score_pct = VALUES(weighted_score_pct),
             gate_status = VALUES(gate_status),
             overall_rating = VALUES(overall_rating),
             confidence_level = VALUES(confidence_level)""",
        (session_id, percentage, gate_status, _overall_rating(percentage), "Medium")
    )

    # ai_audit_results - per-indicator rubric rows (meeting_id/session_id based)
    rubric = audit_results.get("rubric", [])
    oqi = audit_results.get("overall_score") or audit_results.get("oqi_score") or 0
    for item in rubric:
        try:
            execute(
                """INSERT INTO ai_audit_results
                   (meeting_id, session_id, category_id, indicator_id,
                    ai_score, ai_max_score, ai_raw_response, oqi_score,
                    evidence_quote, talk_ratio)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE
                    ai_score = VALUES(ai_score),
                    ai_max_score = VALUES(ai_max_score),
                    ai_raw_response = VALUES(ai_raw_response),
                    oqi_score = VALUES(oqi_score),
                    evidence_quote = VALUES(evidence_quote),
                    talk_ratio = VALUES(talk_ratio)""",
                (
                    meeting_id, session_id,
                    item.get("category_id") or item.get("rubric_id", ""),
                    item.get("indicator_id") or item.get("rubric_id", ""),
                    item.get("score", 0),
                    item.get("max_score", 2),
                    json.dumps({"answer": item.get("answer", "")}),
                    oqi,
                    item.get("evidence", ""),
                    None
                )
            )
        except Exception as item_err:
            log_with_type("warning", f"Engine(task > persist) : Failed to persist rubric item: {item_err}", "TASK")

    log_with_type("info", f"Engine(task > persist) : Audit results persisted for meeting={meeting_id}", "TASK")


def _overall_rating(percentage):
    """Map a percentage to an overall rating string."""
    try:
        pct = float(percentage)
    except (TypeError, ValueError):
        return "Developing"
    if pct >= 90:
        return "Exemplary"
    if pct >= 75:
        return "Proficient"
    if pct >= 50:
        return "Developing"
    return "Beginning"
