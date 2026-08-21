# root/services/engine/task/persist/persist_results_task.py
"""
Persist results task.

Runs AFTER summary and audit have completed and persists the
structured results (summary text + rubric answers + scores + metrics)
into MySQL via database/python_db.py.

Pipeline contract:

    media
      -> transcription
         -> [summary + audit]   (parallel)
         -> persist_results              (this task)
         -> complete
"""

from utils.logger_util import log_with_type

import json

from database.python_db import execute

from services.engine.ai_audit_service.rubric_loader import RubricLoader


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
    """Persist EVERY rubric category + indicator (with weight/value + AI values)
    into ai_audit_results, plus the session_rubric_summary aggregate row."""
    if session_id is None:
        log_with_type("info", "Engine(task > persist) : session_id is None, skipping audit persistence", "TASK")
        return

    # session_rubric_summary - aggregate metrics row (session_id based)
    overall_score = audit_results.get("overall_score") or audit_results.get("oqi_score") or 0
    percentage = audit_results.get("percentage") or overall_score
    gate_status = "all_passed"
    if audit_results.get("metrics", {}).get("failed", 0) > 0:
        gate_status = "gate_failed"
    if audit_results.get("gate_failures"):
        # AI explicitly flagged gate indicators that scored 0.
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

    # Load the FULL rubric (categories + indicators with weight/value) from the DB.
    try:
        raw_rubric = RubricLoader().load_rubric()
    except Exception as e:
        log_with_type("warning", f"Engine(task > persist) : Could not load rubric schema: {e}", "TASK")
        raw_rubric = None

    categories = (raw_rubric or {}).get("categories", []) or []
    indicators = (raw_rubric or {}).get("indicators", []) or []
    if not categories or not indicators:
        log_with_type("warning", "Engine(task > persist) : Rubric schema empty — no per-indicator audit rows written.", "TASK")
        return

    # Build a lookup of AI per-indicator scores (by indicator_id or indicator name).
    score_by_indicator = {}
    for item in (audit_results.get("rubric") or []):
        if not isinstance(item, dict):
            continue
        key = item.get("rubric_id") or item.get("question")
        if key:
            score_by_indicator[key] = {
                # Preserve null score (excluded indicator) — do not coerce to 0.
                "score": item.get("score"),
                "max_score": item.get("max_score", 0),
                "evidence": item.get("evidence", "")
            }
    for cat_name, cat_data in (audit_results.get("category_scores") or {}).items():
        if not isinstance(cat_data, dict):
            continue
        for ind_name, ind_data in (cat_data.get("indicators") or {}).items():
            if not isinstance(ind_data, dict):
                continue
            score_by_indicator[ind_name] = {
                "score": ind_data.get("score"),
                "max_score": ind_data.get("max_score", 0),
                "evidence": ind_data.get("evidence", "")
            }

    # Clear previous rows for this meeting + session, then insert one row per indicator.
    execute("DELETE FROM ai_audit_results WHERE meeting_id = %s AND session_id = %s", (meeting_id, session_id))

    oqi = audit_results.get("overall_score") or audit_results.get("oqi_score") or 0
    evidence_quote = audit_results.get("evidence_quote", "")
    talk_ratio_json = json.dumps(audit_results.get("talk_ratio") or {})

    insert_count = 0
    for cat in categories:
        category_code = cat.get("category_code")  # e.g. 'A'
        category_id = cat.get("id")  # numeric rubric_categories.id
        category_weight = cat.get("weight", 0)
        cat_name = cat.get("name")
        for ind in indicators:
            if ind.get("category_id") != category_id:  # numeric FK == cat id
                continue
            indicator_code = ind.get("indicator_code")  # e.g. 'A1.1'
            indicator_id = ind.get("id")  # numeric rubric_indicators.id
            max_value = ind.get("value") or 1

            ai_score = None
            ai_max = float(max_value)
            evidence = ""

            hit = score_by_indicator.get(indicator_code) or score_by_indicator.get(ind.get("name"))
            if hit and hit.get("score") is not None:
                ai_score = float(hit.get("score") or 0)
                if hit.get("max_score"):
                    ai_max = float(hit["max_score"])
                evidence = hit.get("evidence") or ""
            elif hit:
                # score is null (e.g. video-gated / not scorable): store NULL so it
                # is excluded from aggregation rather than penalized as a zero.
                if hit.get("max_score"):
                    ai_max = float(hit["max_score"])
                evidence = hit.get("evidence") or ""

            try:
                execute(
                    """INSERT INTO ai_audit_results
                       (meeting_id, session_id, category_id, indicator_id,
                        category_name, category_weight, indicator_name, indicator_value, is_gate,
                        ai_score, ai_max_score, ai_evidence, ai_raw_response, oqi_score,
                        evidence_quote, talk_ratio)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON DUPLICATE KEY UPDATE
                        category_name = VALUES(category_name),
                        category_weight = VALUES(category_weight),
                        indicator_name = VALUES(indicator_name),
                        indicator_value = VALUES(indicator_value),
                        is_gate = VALUES(is_gate),
                        ai_score = VALUES(ai_score),
                        ai_max_score = VALUES(ai_max_score),
                        ai_evidence = VALUES(ai_evidence),
                        ai_raw_response = VALUES(ai_raw_response),
                        oqi_score = VALUES(oqi_score),
                        evidence_quote = VALUES(evidence_quote),
                        talk_ratio = VALUES(talk_ratio)""",
                    (
                        meeting_id, session_id, category_id, indicator_id,
                        cat_name, float(category_weight or 0), ind.get("name"),
                        int(max_value), 1 if ind.get("is_gate") else 0,
                        ai_score, ai_max, evidence,
                        json.dumps({
                            "rubric_category_id": category_code,
                            "rubric_indicator_id": indicator_code,
                            "category_id": category_id,
                            "category_name": cat_name,
                            "category_weight": float(category_weight or 0),
                            "indicator_id": indicator_id,
                            "indicator_name": ind.get("name"),
                            "indicator_value": int(max_value),
                            "is_gate": bool(ind.get("is_gate")),
                            "answer": evidence
                        }),
                        oqi,
                        evidence_quote, talk_ratio_json
                    )
                )
                insert_count += 1
            except Exception as ind_err:
                log_with_type("warning", f"Engine(task > persist) : Failed to persist indicator {indicator_id}: {ind_err}", "TASK")

    log_with_type(
        "info",
        f"Engine(task > persist) : Persisted {insert_count} rubric indicator rows into ai_audit_results for meeting={meeting_id} session={session_id}",
        "TASK"
    )


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
