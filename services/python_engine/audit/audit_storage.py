"""
services/python_engine/audit/audit_storage.py
DATA-ACCESS + file persistence for the python_engine audit.
"""
import json
import os
from decimal import Decimal

from database.python_db import get_cursor
from utils.logger_util import log_with_type


def _json_default(o):
    if isinstance(o, Decimal):
        return float(o)
    return str(o)


def _derive_rating(ai_score, ai_max):
    if ai_score is None:
        return "N/A"
    try:
        s = float(ai_score)
    except (TypeError, ValueError):
        return "N/A"
    try:
        m = float(ai_max or 0)
    except (TypeError, ValueError):
        m = 0.0
    if m and s >= m:
        return "Met"
    if s > 0:
        return "Partial"
    return "Not met"


class AuditStorage:
    # ------------------------------------------------------------------
    # Prompt file persistence
    # ------------------------------------------------------------------
    @staticmethod
    def save_prompt_file(output_path, meeting_id, session_id,
                         system_instruction, prompt, ai_client,
                         raw_response=None, status="PENDING"):
        if not output_path:
            return
        try:
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            payload = {
                "task": "audit",
                "provider": ai_client.provider,
                "model": ai_client.model,
                "meeting_id": meeting_id,
                "session_id": session_id,
                "request": {
                    "system_instruction": system_instruction,
                    "prompt": prompt,
                    "replayable_prompt": f"{system_instruction}\n\n{prompt}",
                },
                "response": {"status": status, "raw_response": raw_response},
            }
            with open(output_path, "w", encoding="utf-8") as pf:
                json.dump(payload, pf, indent=2, ensure_ascii=False, default=_json_default)
            log_with_type("info", f"audit/storage: prompt file saved -> {output_path}", "PYTHON_ENGINE")
        except Exception as e:
            log_with_type("warning", f"audit/storage: could not save prompt file -> {e}", "PYTHON_ENGINE")
    @staticmethod
    def store_audit_results(meeting_id, session_id, rubric_schema, ai_result):
        """Insert/update per-indicator rows in ai_audit_results. Returns count."""
        if not meeting_id:
            return 0
        try:
            oqi_score = ai_result.get("oqi_score", 0.0)
            category_scores = ai_result.get("category_scores", {})

            with get_cursor() as cur:
                cur.execute(
                    "DELETE FROM ai_audit_results WHERE meeting_id = %s AND session_id = %s",
                    (meeting_id, session_id),
                )

            # Use a FRESH cursor for the inserts: the DELETE's get_cursor() block
            # above has already closed its connection, so reusing `cur` here
            # raised "2055: Cursor is not connected" and silently aborted storage.
            indicator_count = 0
            with get_cursor() as cur:
                for cat_name, cat_data in category_scores.items():
                    indicators_data = cat_data.get("indicators", {}) if isinstance(cat_data, dict) else {}
                    category_id = ""
                    category_weight = 0.0
                    for cat in rubric_schema:
                        if str(cat.get("category", "")).lower() == str(cat_name).lower():
                            category_id = cat.get("category_id_pk") or cat.get("category_id") or ""
                            category_weight = float(cat.get("weight", 0) or 0)
                            break

                    for ind_name, ind_data in indicators_data.items():
                        ind_ref = _find_indicator(rubric_schema, ind_name)
                        if not ind_ref:
                            continue
                        ai_score = None
                        ai_max = 1
                        ai_evidence = ""
                        ai_rating = None
                        ai_reason = None
                        if isinstance(ind_data, dict):
                            raw_score = ind_data.get("score")
                            raw_max = ind_data.get("max_score") or ind_data.get("value")
                            ai_evidence = str(ind_data.get("evidence") or ind_data.get("evidence_quote") or "").strip()
                            ai_rating = ind_data.get("rating")
                            ai_reason = str(ind_data.get("reason") or "").strip() or None
                            if raw_score is None:
                                ai_score = None
                            else:
                                try:
                                    ai_score = float(raw_score)
                                except (TypeError, ValueError):
                                    ai_score = 0.0
                            if raw_max is not None:
                                try:
                                    ai_max = float(raw_max)
                                except (TypeError, ValueError):
                                    ai_max = 1.0
                        elif isinstance(ind_data, (int, float)):
                            ai_score = float(ind_data)

                        rating = _derive_rating(ai_score, ai_max)
                        if ai_rating and str(ai_rating).strip().lower() in (
                            "met", "not met", "not applicable", "partial", "na", "n/a",
                        ):
                            rating = str(ai_rating).strip()
                        reason = ai_reason or ai_evidence or None

                        # Store ONLY this indicator's own AI response (code, score,
                        # rating, reason, evidence) -- not the whole session JSON.
                        if isinstance(ind_data, dict):
                            ind_raw = json.dumps({
                                "indicator": ind_data.get("indicator") or ind_data.get("indicator_id"),
                                "indicator_name": ind_data.get("question") or ind_name,
                                "score": ai_score,
                                "max_score": ai_max,
                                "rating": rating,
                                "reason": reason,
                                "evidence": ai_evidence,
                            }, ensure_ascii=False, default=_json_default)
                        else:
                            ind_raw = json.dumps({
                                "indicator": ind_ref.get("indicator_id") or ind_name,
                                "indicator_name": ind_name,
                                "score": ai_score,
                                "max_score": ai_max,
                            }, ensure_ascii=False, default=_json_default)

                        cur.execute(
                            """INSERT INTO ai_audit_results
                               (meeting_id, session_id, category_id, indicator_id,
                                category_name, category_weight, indicator_name, indicator_value, is_gate,
                                ai_score, ai_max_score, ai_evidence, rating, reason, benchmark,
                                ai_raw_response, oqi_score, evidence_quote)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                               ON DUPLICATE KEY UPDATE
                                category_weight = VALUES(category_weight),
                                indicator_value = VALUES(indicator_value),
                                is_gate = VALUES(is_gate),
                                ai_score = VALUES(ai_score),
                                ai_max_score = VALUES(ai_max_score),
                                ai_evidence = VALUES(ai_evidence),
                                rating = VALUES(rating),
                                reason = VALUES(reason),
                                benchmark = VALUES(benchmark),
                                ai_raw_response = VALUES(ai_raw_response),
                                oqi_score = VALUES(oqi_score),
                                evidence_quote = VALUES(evidence_quote)""",
                            (
                                meeting_id, session_id,
                                category_id, ind_ref.get("indicator_id_pk") or ind_ref.get("indicator_id"),
                                cat_name, category_weight, ind_name,
                                float(ind_ref.get("value", 1)), 1 if ind_ref.get("is_gate") else 0,
                                ai_score, ai_max, ai_evidence, rating, reason, ind_ref.get("benchmark"),
                                ind_raw, oqi_score, ai_evidence,
                            ),
                        )
                        indicator_count += 1

            log_with_type("info", f"audit/storage: stored {indicator_count} indicator rows in ai_audit_results", "PYTHON_ENGINE")
            return indicator_count
        except Exception as e:
            log_with_type("error", f"audit/storage: failed to store audit results -> {e}", "PYTHON_ENGINE")
            return 0
    @staticmethod
    def store_summary(meeting_id, session_id, ai_result):
        """Write/update session_rubric_summary.

        The table schema (migration 057) has NO meeting_id / gate_failures /
        evidence_quote columns; it is keyed on session_id UNIQUE. Only write the
        columns that actually exist so the upsert does not fail.
        """
        try:
            oqi_score = ai_result.get("oqi_score", 0.0)
            gate_failures = ai_result.get("gate_failures", [])
            with get_cursor() as cur:
                cur.execute(
                    """INSERT INTO session_rubric_summary
                       (session_id, weighted_score_pct, gate_status)
                       VALUES (%s,%s,%s)
                       ON DUPLICATE KEY UPDATE
                        weighted_score_pct = VALUES(weighted_score_pct),
                        gate_status = VALUES(gate_status)""",
                    (
                        session_id, oqi_score,
                        "all_passed" if not gate_failures else "gate_failed",
                    ),
                )
            log_with_type("info", f"audit/storage: summary saved for session={session_id} oqi={oqi_score}", "PYTHON_ENGINE")
        except Exception as e:
            log_with_type("error", f"audit/storage: failed to store summary -> {e}", "PYTHON_ENGINE")


def _find_indicator(rubric_schema, ind_name):
    for cat in rubric_schema:
        for ind in cat.get("indicators", []):
            if ind.get("name") == ind_name or ind.get("indicator_id") == ind_name:
                return ind
    return None