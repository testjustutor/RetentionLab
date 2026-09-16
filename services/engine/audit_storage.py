"""
services/engine/audit_storage.py
DATA-ACCESS + file persistence for the consolidated python_engine audit.
"""
import json
import os
from decimal import Decimal

from database.python_db import get_cursor
from utils.logger_util import log_with_type
from services.engine.audit_scoring import (
    compute_category_score_from_counts,
    compute_weighted_overall,
)
from services.engine.llm_cache import build_messages, generation_params


def _json_default(o):
    if isinstance(o, Decimal):
        return float(o)
    return str(o)


class AuditStorage:
    # ------------------------------------------------------------------
    # Prompt file persistence
    # ------------------------------------------------------------------
    @staticmethod
    def save_prompt_file(request_path, response_path, meeting_id, session_id, base_id, call,
                         system_instruction, prompt, ai_client,
                         raw_response=None, status="PENDING"):
        """
        Persist ONE LLM call's request/response as a SEPARATE file pair
        (one request file + one response file PER LLM call, never a merged
        per-session file):

            storage/cache_llm_prompts/PROMPT_<base_id>_<call>.json
            storage/cache_llm_prompts_responce/RESPONSE_<base_id>_<call>.json

        `call` is "audit" for this module - the only AI call the engine makes.
        (The tutor_eval / analysis LLM calls were removed; all scoring is done
        in Python by audit_scoring.py, so this is the sole file pair.)

        The request file is written before the AI call (survives a crash
        mid-call) and is self-contained enough to replay: system_instruction
        + prompt as originally sent, the equivalent chat "messages" array,
        and the generation "parameters" actually used for this provider.
        The response file is written after the call and holds the EXACT raw
        text the provider returned.
        """
        if not request_path:
            return
        try:
            os.makedirs(os.path.dirname(request_path) or ".", exist_ok=True)
            request_doc = {
                "task": call,
                "provider": ai_client.provider,
                "model": ai_client.model,
                "meeting_id": meeting_id,
                "session_id": session_id,
                "base_id": base_id,
                "call": call,
                "request": {
                    "system_instruction": system_instruction,
                    "prompt": prompt,
                    "messages": build_messages(system_instruction, prompt),
                    "parameters": generation_params(ai_client),
                },
            }
            with open(request_path, "w", encoding="utf-8") as rf:
                json.dump(request_doc, rf, indent=2, ensure_ascii=False, default=_json_default)
            log_with_type("info", f"audit/storage: request cache saved -> {request_path}", "PYTHON_ENGINE")
        except Exception as e:
            log_with_type("warning", f"audit/storage: could not save request cache -> {e}", "PYTHON_ENGINE")

        if raw_response is None or not response_path:
            return
        try:
            os.makedirs(os.path.dirname(response_path) or ".", exist_ok=True)
            response_doc = {
                "task": call,
                "provider": ai_client.provider,
                "model": ai_client.model,
                "meeting_id": meeting_id,
                "session_id": session_id,
                "base_id": base_id,
                "call": call,
                "status": status,
                "raw_response": raw_response,
            }
            with open(response_path, "w", encoding="utf-8") as pf:
                json.dump(response_doc, pf, indent=2, ensure_ascii=False, default=_json_default)
            log_with_type("info", f"audit/storage: response cache saved -> {response_path}", "PYTHON_ENGINE")
        except Exception as e:
            log_with_type("warning", f"audit/storage: could not save response cache -> {e}", "PYTHON_ENGINE")

    @staticmethod
    def store_audit_results(meeting_id, session_id, rubric_schema, ai_result):
        """Insert/update per-indicator rows in ai_audit_results AND compute the
        per-category / overall rollups in ai_audit_category_scores +
        ai_audit_overall_summary. Returns the number of indicators written.

        ai_audit_results now stores the STATUS-CODE-ONLY per-indicator schema
        (status_code: 1=Met, 2=Not Met, 3=Not Applicable, is_gate, ai_evidence,
        reason) — the score/name/benchmark columns were dropped in the 055
        rewrite. Category/indicator display fields resolve via
        rubric_categories / rubric_indicators join.

        Per-category score follows review_calculation_logic.txt's 'submit' rule:
          - calc_source='submit'  -> category = Met/(Met+NA), all-NA -> 100%
          - calc_source='update'  -> category = Met/(Met+NotMet), all-Not-Met -> 100%
        The AI pass is a single fresh evaluation, so it is persisted with
        calc_source='submit' (the 'update' quirk is stored only when a review
        update flow writes it later).

        The OVERALL/final score, however, is a weighted average of the
        category scores by each category's CONFIGURED rubric weight
        (falls back to 1 when unweighted) — matching computeFinalScore() in
        controllers/reviewer/tutorEvaluationController.js — not by criteria
        count as review_calculation_logic.txt originally documented. See
        TODO.md for why this changed.
        """
        if not meeting_id:
            return 0
        try:
            category_scores = ai_result.get("category_scores", {})

            with get_cursor() as cur:
                cur.execute(
                    "DELETE FROM ai_audit_results WHERE meeting_id = %s AND session_id = %s",
                    (meeting_id, session_id),
                )
                deleted_count = cur.rowcount
                for tbl in ("ai_audit_category_scores", "ai_audit_overall_summary"):
                    cur.execute(
                        f"DELETE FROM {tbl} WHERE meeting_id = %s AND session_id = %s",
                        (meeting_id, session_id),
                    )
            log_with_type(
                "info",
                f"audit/storage: DELETE ai_audit_results -> {deleted_count} old row(s) cleared "
                f"(meeting_id={meeting_id}, session_id={session_id})",
                "PYTHON_ENGINE",
            )

            indicator_count = 0
            category_rows = []           # (category_score, category_weight) — drives final_score
            category_rows_by_count = []  # (category_score, total_criteria) — informational columns only
            with get_cursor() as cur:
                for cat_name, cat_data in category_scores.items():
                    indicators_data = cat_data.get("indicators", {}) if isinstance(cat_data, dict) else {}
                    category_id = None
                    category_weight = 0.0
                    for cat in rubric_schema:
                        if str(cat.get("category", "")).lower() == str(cat_name).lower():
                            category_id = cat.get("category_id_pk") or cat.get("category_id") or None
                            category_weight = float(cat.get("weight", 0) or 0)
                            break

                    met = not_met = na = 0
                    for ind_name, ind_data in indicators_data.items():
                        ind_ref = _find_indicator(rubric_schema, ind_name)
                        if not ind_ref:
                            continue

                        status_code = None
                        ai_evidence = ""
                        ai_reason = None
                        if isinstance(ind_data, dict):
                            status_code = ind_data.get("status_code")
                            ai_evidence = str(ind_data.get("evidence") or ind_data.get("evidence_quote") or "").strip()
                            ai_reason = ind_data.get("reason")
                            raw_score = ind_data.get("score")
                        else:
                            raw_score = ind_data

                        # Derive a status code when the caller didn't provide one.
                        if status_code is None:
                            if isinstance(raw_score, (int, float)):
                                status_code = 1 if float(raw_score) >= 1 else 2
                            else:
                                status_code = 3
                        try:
                            status_code = int(status_code)
                        except (TypeError, ValueError):
                            status_code = 3
                        if status_code not in (1, 2, 3):
                            status_code = 3

                        if status_code == 1:
                            met += 1
                        elif status_code == 2:
                            not_met += 1
                        else:
                            na += 1

                        reason = (ai_reason or ai_evidence or "").strip() or None

                        cur.execute(
                            """INSERT INTO ai_audit_results
                               (meeting_id, session_id, category_id, indicator_id,
                                status_code, is_gate, ai_evidence, reason, scored_at)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,CURRENT_TIMESTAMP)
                               ON DUPLICATE KEY UPDATE
                                status_code = VALUES(status_code),
                                is_gate = VALUES(is_gate),
                                ai_evidence = VALUES(ai_evidence),
                                reason = VALUES(reason),
                                scored_at = CURRENT_TIMESTAMP""",
                            (
                                meeting_id, session_id,
                                category_id, ind_ref.get("indicator_id_pk") or ind_ref.get("indicator_id"),
                                status_code, 1 if ind_ref.get("is_gate") else 0,
                                ai_evidence, reason,
                            ),
                        )
                        indicator_count += 1
                        log_with_type(
                            "info",
                            f"audit/storage: INSERT ai_audit_results row #{indicator_count} -> "
                            f"session={session_id}, indicator={ind_name}, status={status_code}",
                            "PYTHON_ENGINE",
                        )

                    # Per-category rollup (review_calculation_logic.txt, submit flow).
                    if category_id is None:
                        continue
                    cat_score = compute_category_score_from_counts(met, not_met, na, calc_source="submit")
                    cat_total = met + not_met + na
                    weight_for_overall = category_weight if category_weight > 0 else 1
                    category_rows.append((cat_score, weight_for_overall))
                    category_rows_by_count.append((cat_score, cat_total))
                    cur.execute(
                        """INSERT INTO ai_audit_category_scores
                           (meeting_id, session_id, category_id,
                            count_met, count_not_met, count_not_applicable, total_criteria,
                            category_score, calc_source, category_weight)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'submit',%s)
                           ON DUPLICATE KEY UPDATE
                            count_met = VALUES(count_met),
                            count_not_met = VALUES(count_not_met),
                            count_not_applicable = VALUES(count_not_applicable),
                            total_criteria = VALUES(total_criteria),
                            category_score = VALUES(category_score),
                            category_weight = VALUES(category_weight)""",
                        (
                            meeting_id, session_id, category_id,
                            met, not_met, na, cat_total,
                            cat_score, category_weight,
                        ),
                    )

                # Overall rollup: final_score is now a weighted average of
                # category scores by each category's CONFIGURED rubric weight
                # (category_rows holds (category_score, weight) pairs — see
                # the weight_for_overall assignment above), matching
                # computeFinalScore() in tutorEvaluationController.js.
                #
                # total_weighted_percent / total_criteria_all remain the
                # original criteria-count-based figures (informational only —
                # NOT what final_score is derived from) so existing readers of
                # those two columns are unaffected by this change.
                total_criteria_all = sum(t for _, t in category_rows_by_count)
                total_weighted_percent = sum(
                    (float(score or 0) * int(total or 0))
                    for score, total in category_rows_by_count
                )
                final_score = compute_weighted_overall(category_rows)
                cur.execute(
                    """INSERT INTO ai_audit_overall_summary
                       (meeting_id, session_id, final_score,
                        total_weighted_percent, total_criteria_all,
                        calc_source, red_flag, overall_summary)
                       VALUES (%s,%s,%s,%s,%s,'submit',NULL,NULL)
                       ON DUPLICATE KEY UPDATE
                        final_score = VALUES(final_score),
                        total_weighted_percent = VALUES(total_weighted_percent),
                        total_criteria_all = VALUES(total_criteria_all)""",
                    (
                        meeting_id, session_id, final_score,
                        total_weighted_percent, total_criteria_all,
                    ),
                )

            log_with_type(
                "info",
                f"audit/storage: INSERT ai_audit_results -> {indicator_count} indicator row(s) written "
                f"(meeting_id={meeting_id}, session_id={session_id})",
                "PYTHON_ENGINE",
            )
            return indicator_count
        except Exception as e:
            log_with_type(
                "error",
                f"audit/storage: ai_audit_results write FAILED (meeting_id={meeting_id}, session_id={session_id}) -> {e}",
                "PYTHON_ENGINE",
            )
            return 0

    @staticmethod
    def store_summary(meeting_id, session_id, ai_result):
        """Write/update session_rubric_summary.

        gate_status is derived ONLY from actual gate-indicator failures
        (ai_result["gate_failures"]) — never from the total count of
        non-gate "Not Met" indicators, so a single ordinary Not Met can no
        longer flip the whole session into gate_failed.

        session_rubric_summary.weighted_score_pct stays a numeric decimal;
        this table did NOT change to TEXT (only ai_audit_results.oqi_score did).
        """
        try:
            oqi_score = ai_result.get("oqi_score", 0.0)
            gate_failures = ai_result.get("gate_failures", [])
            with get_cursor() as cur:
                gate_status = "all_passed" if not gate_failures else "gate_failed"
                overall_rating = (
                    "Exemplary" if oqi_score >= 90
                    else "Proficient" if oqi_score >= 75
                    else "Developing" if oqi_score >= 50
                    else "Beginning"
                )
                cur.execute(
                    """INSERT INTO session_rubric_summary (session_id, weighted_score_pct, gate_status, overall_rating)
                       VALUES (%s,%s,%s,%s)
                       ON DUPLICATE KEY UPDATE weighted_score_pct=VALUES(weighted_score_pct),
                       gate_status=VALUES(gate_status), overall_rating=VALUES(overall_rating)""",
                    (session_id, oqi_score, gate_status, overall_rating)
                )
            log_with_type(
                "info",
                f"audit/storage: UPSERT session_rubric_summary -> meeting_id={meeting_id}, session_id={session_id}, "
                f"oqi={oqi_score}, gate_status={gate_status}, rating={overall_rating}",
                "PYTHON_ENGINE",
            )
        except Exception as e:
            log_with_type(
                "error",
                f"audit/storage: session_rubric_summary write FAILED (meeting_id={meeting_id}, session_id={session_id}) -> {e}",
                "PYTHON_ENGINE",
            )


def _find_indicator(rubric_schema, ind_name):
    for cat in rubric_schema:
        for ind in cat.get("indicators", []):
            if ind.get("name") == ind_name or ind.get("indicator_id") == ind_name:
                return ind
    return None