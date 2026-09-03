# services/engine/services/tutor_eval_worker.py
"""
AI-driven Tutor Session Evaluation.

Purely engine-side (no UI page). Loads the rubric criteria (categories +
indicators with their benchmark/description), sends one AI call that rates
each criterion as Met / Not Met / Not Applicable (transcript-only evaluation),
then COMPUTES the category + overall percentages in code and persists the
results to MySQL:

  - session_rubric_evaluations  -> one row per indicator (rating + reason)
  - session_rubric_summary      -> overall weighted_score_pct + gate_status + red_flag
  - session_final_evaluation    -> overall summary narrative + rating

It ALSO records the EXACT request sent to the AI and the EXACT raw response
returned by the AI into storage/cache_llm_prompts/EVAL_<base_id>.json so the
prompt can be copy-pasted into a direct AI chat and reproduce the same output.

Calculations happen in code (the project's "score calculation in code, not LLM"
design) so the math is trustworthy and auditable:

    category_percentage =
        (count of Met) / (total indicators in category - count of Not Applicable) * 100

    overall percentage =
        weighted by category weight when available, else simple average
        of the category percentages.
"""

import json
import os
import re
import sys
import time
import traceback
from decimal import Decimal

from services.engine.services import AiApiService
from services.engine.services.rubric_loader import RubricLoader


def _json_default(o):
    if isinstance(o, Decimal):
        return float(o)
    return str(o)


class TutorEvaluationError(RuntimeError):
    pass


class TutorEvaluationService:
    def __init__(self, ai_config):
        self.ai_api = AiApiService(ai_config)


    # ==========================================================
    # PROMPT BUILDING
    # ==========================================================
    def _build_system_instruction(self):
        return (
            "You are an isolated QA evaluation microservice evaluating a tutor session from a transcript.\n\n"
            "INPUT MODE: This evaluation runs on AUDIO/TRANSCRIPT ONLY. No video feed is available.\n\n"
            "For each provided criterion you MUST choose exactly one rating from:\n"
            '  - "Met"               : the transcript demonstrates the criterion.\n'
            '  - "Not Met"           : the transcript shows the criterion was not met.\n'
            '  - "Not Applicable"    : the criterion does not apply to this session.\n\n'
            "RULES:\n"
            '1. Each criterion includes a "benchmark" describing what good looks like — use it as your standard, not the name alone.\n'
            '2. A criterion marked "Not Met" MUST have a non-empty "reason" explaining why.\n'
            '3. Prefer "Met" / "Not Met" over "Not Applicable". Only use "Not Applicable" when the criterion genuinely does not apply.\n'
            '4. Cite the specific line(s) of transcript that justify each rating.\n'
            "5. After rating all criteria, provide a concise free-text overall summary of the tutor session.\n"
            '6. Set "red_flag" to true only if there is a serious concern that warrants raising a red flag.\n'
            "7. You must return ONLY a raw JSON string matching this structure exactly. No conversational text, no markdown wrappers, no code fences:\n"
            "{\n"
            '  "category_evaluations": {\n'
            '    "Category Name": {\n'
            '      "indicators": {\n'
            '        "Indicator Name": { "rating": "Met", "reason": "quote from transcript justifying the rating" }\n'
            "      }\n"
            "    }\n"
            "  },\n"
            '  "overall_summary": "Concise free-text summary of the tutor session.",\n'
            '  "red_flag": false\n'
            "}"
        )

    def _build_prompt(self, raw_rubric, transcript_text):
        rubric_block = json.dumps(raw_rubric, indent=2, default=_json_default)
        return (
            "Rubric Target Rules (rate each criterion):\n"
            f"{rubric_block}\n\n"
            "Transcript Target Data:\n"
            f"{transcript_text}"
        )

    def _build_analysis_system_instruction(self):
        return (
            "You are an isolated QA analysis microservice evaluating a tutor session from a transcript.\n\n"
            "INPUT MODE: This evaluation runs on AUDIO/TRANSCRIPT ONLY. No video feed is available.\n\n"
            "Based ONLY on the provided rubric ratings and the transcript, produce:\n"
            '  1) "what_worked_well"        : array of strings — approaches/behaviors that worked.\n'
            '  2) "what_needs_improvement"   : array of strings — areas the tutor should improve.\n'
            '  3) "missed_opportunities"     : array of strings — teaching moments/opportunities missed.\n'
            '  4) "indicator_scores"         : per-indicator score (0 to its max value) keyed by indicator_code.\n'
            "     Use the rating to drive the score: Met = max value, Not met = 0, Not Applicable = omit.\n"
            '  5) "overall_rating"           : one of "Exemplary", "Proficient", "Developing", "Beginning".\n'
            '  6) "teacher_performance"      : short rating label/note for the tutor performance.\n'
            '  7) "student_engagement"       : short rating label/note for student engagement.\n'
            '  8) "learning_impact"          : short rating label/note for learning impact.\n'
            '  9) "parent_communication_readiness" : one of "ready", "needs_preparation", "not_ready".\n'
            '  10) "recommended_action"       : short recommended next action.\n'
            "     You must return ONLY a raw JSON string matching this structure. No conversational text, no markdown wrappers, no code fences:\n"
            "{\n"
            '  "what_worked_well": ["..."],\n'
            '  "what_needs_improvement": ["..."],\n'
            '  "missed_opportunities": ["..."],\n'
            '  "indicator_scores": { "A1.1": 1, "A2.2": 0 },\n'
            '  "overall_session_rating": "Proficient",\n'
            '  "teacher_performance": "Clear and supportive",\n'
            '  "student_engagement": "Active and responsive",\n'
            '  "learning_impact": "Concepts reinforced",\n'
            '  "parent_communication_readiness": "ready",\n'
            '  "recommended_action": "Continue current approach."\n'
            "}"
        )

    def _build_analysis_prompt(self, raw_rubric, parsed, transcript_text):
        """Second AI call builds session analysis + per-indicator scores from the
        rubric ratings already produced by call 1 and the transcript."""
        rubric_block = json.dumps(raw_rubric, indent=2, default=_json_default)
        ratings_block = json.dumps(parsed.get("category_evaluations") or {}, indent=2, default=_json_default)
        return (
            "Rubric (categories + indicators with max value):\n"
            f"{rubric_block}\n\n"
            "AI ratings per indicator (from the prior evaluation call):\n"
            f"{ratings_block}\n\n"
            "Transcript Target Data:\n"
            f"{transcript_text}"
        )


    # ==========================================================
    # EXACT PROMPT + RESPONSE CACHE (recurring hard requirement)
    # ==========================================================
    def _save_eval_file(
        self, prompt_output_path, meeting_id, session_id,
        system_instruction, prompt, raw_response=None,
        status="PENDING", computed=None,
        analysis_instruction=None, analysis_prompt=None, analysis_response=None,
    ):
        """Persist the EXACT request + EXACT raw response (+ computed results).
        Optionally also stores a second AI call (analysis) under request_2/response_2."""
        if not prompt_output_path:
            return
        try:
            os.makedirs(os.path.dirname(prompt_output_path) or ".", exist_ok=True)
            model = None
            try:
                model = self.ai_api.model
            except Exception:
                model = None

            messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt},
            ]

            payload = {
                "task": "tutor_evaluation",
                "provider": self.ai_api.provider,
                "model": model,
                "meeting_id": meeting_id,
                "session_id": session_id,
                "request": {
                    "system_instruction": system_instruction,
                    "prompt": prompt,
                    "messages": messages,
                    "replayable_prompt": f"{system_instruction}\n\n{prompt}",
                },
                "response": {
                    "status": status,
                    "raw_response": raw_response,
                },
                "computed": computed or {},
            }

            if analysis_instruction and analysis_prompt:
                payload["request_2"] = {
                    "system_instruction": analysis_instruction,
                    "prompt": analysis_prompt,
                    "messages": [
                        {"role": "system", "content": analysis_instruction},
                        {"role": "user", "content": analysis_prompt},
                    ],
                    "replayable_prompt": f"{analysis_instruction}\n\n{analysis_prompt}",
                }
                payload["response_2"] = {
                    "status": "OK" if analysis_response is not None else "PENDING",
                    "raw_response": analysis_response,
                }

            with open(prompt_output_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False, default=_json_default)

            print(
                f"[TUTOR EVAL] Status: Prompt + AI response saved to {prompt_output_path}",
                flush=True,
            )
        except Exception as e:
            print(
                f"[TUTOR EVAL] WARNING: Could not save eval file: {e}",
                flush=True,
            )


    # ==========================================================
    # CODE-BASED PERCENTAGE CALCULATION
    # ==========================================================
    def _compute_percentages(self, raw_rubric, parsed):
        """
        category_percentage = Met / (total - Not Applicable) * 100
        overall = weighted by category weight, else simple average.
        """
        cat_eval = parsed.get("category_evaluations") or {}

        categories = {c["id"]: c for c in raw_rubric.get("categories", [])}
        by_category = {}
        for ind in raw_rubric.get("indicators", []):
            by_category.setdefault(ind["category_id"], []).append(ind)  # numeric FK

        category_percentages = {}
        category_weights = {}
        category_breakdown = {}

        for cat_id, inds in by_category.items():
            cat_meta = categories.get(cat_id, {})
            cat_name = cat_meta.get("name", cat_id)
            weight = float(cat_meta.get("weight") or 0)
            if weight <= 0:
                weight = 1.0

            total = len(inds)
            met = 0
            na = 0
            not_met = 0
            rated = []

            ind_evals = cat_eval.get(cat_name, {}).get("indicators", {})
            for ind in inds:
                entry = ind_evals.get(ind["name"]) or {}
                rating = (entry.get("rating") or "").strip().lower()
                if rating in ("met", "not met", "not applicable"):
                    if rating == "met":
                        met += 1
                    elif rating == "not met":
                        not_met += 1
                    else:
                        na += 1
                    rated.append({
                        "indicator_id": ind.get("indicator_code"),
                        "indicator_name": ind.get("name"),
                        "subgroup_name": ind.get("subgroup_name"),
                        "rating": rating,
                        "reason": entry.get("reason", ""),
                    })

            eligible = total - na
            pct = round((met / eligible * 100), 2) if eligible > 0 else 0.0

            category_percentages[cat_name] = pct
            category_weights[cat_name] = weight
            category_breakdown[cat_name] = {
                "category_id": cat_id,
                "total": total,
                "met": met,
                "not_met": not_met,
                "not_applicable": na,
                "eligible": eligible,
                "percentage": pct,
                "rated": rated,
            }

        # overall: weighted by category weight, else simple average
        if category_percentages:
            total_w = sum(category_weights.values())
            overall = round(
                sum((category_percentages[k] * category_weights[k]) for k in category_percentages) / total_w,
                2,
            ) if total_w else 0.0
        else:
            overall = 0.0

        return {
            "category_percentages": category_percentages,
            "category_breakdown": category_breakdown,
            "overall_percentage": overall,
        }


    # ==========================================================
    # PERSISTENCE
    # ==========================================================
    def _resolve_admin_indicator_ids(self, meeting_id):
        """
        Map master rubric_indicators.id -> admin_rubric_indicators.id for the
        admin whose rubric governs this meeting.

        Fully dynamic (no hardcoded ids):
          1. Resolve the meeting owner via meetings.calendar_account -> users.id.
          2. The admin who owns the rubric is the owner's manager: users.created_by.
             Fall back to the user themselves if no created_by, then to an admin
             (role_name='admin') in the same company when there's no direct link.
          3. Load admin_rubric_indicators copies for that admin.
        Returns an empty dict when no admin rubric copies exist (score step skipped).
        """
        from database.python_db import fetch_one

        if not meeting_id:
            return {}

        # 1. Meeting owner (instructor) from the calendar account.
        owner = fetch_one(
            """
            SELECT u.id, u.created_by, u.company_id
            FROM meetings m
            JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
            WHERE m.id = %s LIMIT 1
            """,
            (meeting_id,),
        )
        if not owner:
            return {}

        candidates = []
        # 2a. Direct manager chain (owner was created by an admin).
        if owner.get("created_by"):
            candidates.append(int(owner["created_by"]))
        # 2b. The owner themself (could BE the admin).
        candidates.append(int(owner["id"]))
        # 2c. Any admin in the same company as a dynamic fallback.
        if owner.get("company_id"):
            from database.python_db import fetch_all as _fa
            admins = _fa(
                """
                SELECT u.id FROM users u
                JOIN roles r ON r.id = u.role_id
                WHERE u.company_id = %s AND r.role_name = 'admin'
                AND u.deleted_at IS NULL
                """,
                (owner["company_id"],),
            )
            candidates.extend(int(a["id"]) for a in (admins or []))

        from database.python_db import fetch_all

        # 3. First candidate that actually has admin_rubric_indicators copies wins.
        for admin_user_id in dict.fromkeys(candidates):
            rows = fetch_all(
                """
                SELECT master_indicator_id, id AS admin_indicator_id
                FROM admin_rubric_indicators
                WHERE admin_user_id = %s AND master_indicator_id IS NOT NULL
                """,
                (admin_user_id,),
            )
            if rows:
                return {
                    int(r["master_indicator_id"]): int(r["admin_indicator_id"])
                    for r in rows
                }
        return {}

    def _persist(self, session_id, meeting_id, raw_rubric, parsed, computed,
                 raw_response_text=None, evidence_quote=None, analysis=None):
        from database.python_db import execute, fetch_one

        # Resolve the admin rubric copies for this meeting's admin user.
        # meeting_session_scores.indicator_id is an INT FK to admin_rubric_indicators.id,
        # so we map each master indicator (rubric_indicators.id) to the admin copy id.
        admin_indicator_ids = self._resolve_admin_indicator_ids(meeting_id)

        cat_eval = parsed.get("category_evaluations") or {}
        overall_pct = computed["overall_percentage"]
        overall_summary = (parsed.get("overall_summary") or "").strip()
        red_flag = bool(parsed.get("red_flag"))
        evidence_quote = (evidence_quote or parsed.get("evidence_quote") or "").strip() or None
        ai_raw_response_json = raw_response_text or json.dumps(parsed, default=_json_default)

        categories = {c["id"]: c for c in raw_rubric.get("categories", [])}  # keyed by numeric id
        cat_id_to_name = {cid: c.get("name") for cid, c in categories.items()}
        cat_id_to_weight = {cid: float(c.get("weight") or 0) for cid, c in categories.items()}
        # Numeric ids come straight from the loader: rubric_indicators.category_id
        # is already the numeric FK to rubric_categories.id, and ind['id'] is the
        # numeric rubric_indicators.id. No code->pk maps needed.

        # 1) Resolve per-indicator data + persist to session_rubric_evaluations
        #    and collect ai_audit_results rows.
        #    Rating -> ai_score mapping (null-safe aggregation):
        #      Met            -> full value (indicator.value)
        #      Not Met        -> 0
        #      Not Applicable -> NULL (excluded from category/overall math)
        submitted = 0
        ai_rows = []
        for ind in raw_rubric.get("indicators", []):
            cat_id = ind.get("category_id")
            cat_name = cat_id_to_name.get(cat_id, "")
            ind_evals = cat_eval.get(cat_name, {}).get("indicators", {})
            entry = ind_evals.get(ind.get("name")) or {}
            rating_raw = (entry.get("rating") or "").strip().lower()
            if rating_raw == "met":
                rating = "Met"
            elif rating_raw == "not met":
                rating = "Not met"
            else:
                # 'not applicable' and any unknown/missing -> N/A
                rating = "N/A"

            reason = entry.get("reason", "")
            execute(
                """INSERT INTO session_rubric_evaluations
                   (session_id, indicator_id, rating, comment, evaluated_by, confidence)
                   VALUES (%s, %s, %s, %s, 'HUMAN', 'High')
                   ON DUPLICATE KEY UPDATE
                     rating = VALUES(rating),
                     comment = VALUES(comment),
                     evaluated_by = VALUES(evaluated_by),
                     confidence = VALUES(confidence),
                     updated_at = CURRENT_TIMESTAMP""",
                (session_id, ind.get("indicator_code"), rating, reason or None),
            )
            submitted += 1

            # map to ai_audit_results score semantics
            value = ind.get("value")
            try:
                max_score = float(value) if value is not None else 1.0
            except (TypeError, ValueError):
                max_score = 1.0
            if rating == "Met":
                ai_score = max_score
            elif rating == "Not met":
                ai_score = 0.0
            else:
                ai_score = None  # Not Applicable -> excluded

            ai_rows.append((
                meeting_id, session_id,
                cat_id,                        # numeric rubric_categories.id (FK)
                ind.get("id"),                 # numeric rubric_indicators.id
                cat_name, cat_id_to_weight.get(cat_id, 0.0), ind.get("name"),
                max_score, 1 if ind.get("is_gate") else 0,
                ai_score, max_score, reason or None,
                rating, reason or None, ind.get("benchmark"),
                # Full AI response, so ai_audit_results carries the exact output.
                ai_raw_response_json,
                overall_pct, evidence_quote, None,
            ))

        # 2) ai_audit_results — delete-then-insert (no unique key on this table).
        execute(
            "DELETE FROM ai_audit_results WHERE meeting_id = %s AND session_id = %s",
            (meeting_id, session_id),
        )
        for row in ai_rows:
            execute(
                """INSERT INTO ai_audit_results
                   (meeting_id, session_id, category_id, indicator_id,
                    category_name, category_weight, indicator_name, indicator_value, is_gate,
                    ai_score, ai_max_score, ai_evidence, rating, reason, benchmark, ai_raw_response,
                    oqi_score, evidence_quote, talk_ratio)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE
                     category_name = VALUES(category_name),
                     category_weight = VALUES(category_weight),
                     indicator_name = VALUES(indicator_name),
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
                     evidence_quote = VALUES(evidence_quote),
                     talk_ratio = VALUES(talk_ratio)""",
                row,
            )

        # 3) One aggregate summary row in session_rubric_summary (incl. red_flag)
        gate_status = "gate_failed" if red_flag else "all_passed"
        overall_rating = "Exemplary" if overall_pct >= 90 else "Proficient" if overall_pct >= 75 else "Developing" if overall_pct >= 50 else "Beginning"
        execute(
            """INSERT INTO session_rubric_summary
               (session_id, weighted_score_pct, gate_status, overall_rating, confidence_level, red_flag)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                 weighted_score_pct = VALUES(weighted_score_pct),
                 gate_status = VALUES(gate_status),
                 overall_rating = VALUES(overall_rating),
                 confidence_level = VALUES(confidence_level),
                 red_flag = VALUES(red_flag),
                 updated_at = CURRENT_TIMESTAMP""",
            (session_id, overall_pct, gate_status, overall_rating,
             "Manual tutor evaluation — transcript-based", 1 if red_flag else 0),
        )

        # 4) Final evaluation (overall summary narrative + rating) — use the
        #    analysis (call 2) fields when available.
        analysis = analysis or {}
        final_rating = analysis.get("overall_session_rating") or overall_rating
        teacher_performance = analysis.get("teacher_performance") or ""
        student_engagement = analysis.get("student_engagement") or ""
        learning_impact = analysis.get("learning_impact") or ""
        parent_readiness = analysis.get("parent_communication_readiness") or ""
        recommended_action = analysis.get("recommended_action") or ("Schedule a coaching review." if red_flag else "Continue current approach.")
        execute(
            """INSERT INTO session_final_evaluation
               (session_id, overall_session_rating, teacher_performance, student_engagement,
                learning_impact, parent_communication_readiness, recommended_action, summary_narrative)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                 overall_session_rating = VALUES(overall_session_rating),
                 teacher_performance = VALUES(teacher_performance),
                 student_engagement = VALUES(student_engagement),
                 learning_impact = VALUES(learning_impact),
                 parent_communication_readiness = VALUES(parent_communication_readiness),
                 recommended_action = VALUES(recommended_action),
                 summary_narrative = VALUES(summary_narrative),
                 updated_at = CURRENT_TIMESTAMP""",
            (session_id, final_rating, teacher_performance, student_engagement,
             learning_impact, parent_readiness, recommended_action, overall_summary),
        )

        # 5) session_analysis — JSON columns from the analysis (call 2) response.
        execute(
            """INSERT INTO session_analysis
               (session_id, what_worked_well, what_needs_improvement, missed_opportunities)
               VALUES (%s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                 what_worked_well = VALUES(what_worked_well),
                 what_needs_improvement = VALUES(what_needs_improvement),
                 missed_opportunities = VALUES(missed_opportunities),
                 updated_at = CURRENT_TIMESTAMP""",
            (session_id,
             json.dumps(analysis.get("what_worked_well") or [], ensure_ascii=False, default=_json_default),
             json.dumps(analysis.get("what_needs_improvement") or [], ensure_ascii=False, default=_json_default),
             json.dumps(analysis.get("missed_opportunities") or [], ensure_ascii=False, default=_json_default)),
        )

        # 6) meeting_session_scores — one row per indicator (score + comment from
        #    the AI rating/reason). indicator_id is an INT FK to admin_rubric_indicators.id,
        #    so we write the resolved admin copy id (matching master_indicator_id).
        score_map = analysis.get("indicator_scores") or {}
        mss_count = 0
        execute(
            "DELETE FROM meeting_session_scores WHERE meeting_id = %s AND session_id = %s",
            (meeting_id, session_id),
        )
        for ind in raw_rubric.get("indicators", []):
            cat_name = cat_id_to_name.get(ind.get("category_id"), "")
            entry = cat_eval.get(cat_name, {}).get("indicators", {}).get(ind.get("name")) or {}
            rating_raw = (entry.get("rating") or "").strip().lower()
            code = ind.get("indicator_code")
            if rating_raw == "not applicable":
                continue  # skip N/A for meeting_session_scores
            master_ind_id = ind.get("id")
            admin_ind_id = admin_indicator_ids.get(int(master_ind_id)) if master_ind_id is not None else None
            if admin_ind_id is None:
                # No admin rubric copy for this indicator — cannot satisfy the FK,
                # so skip rather than fail the whole evaluation.
                print(f"[TUTOR EVAL] Skipping meeting_session_scores for indicator {code}: no admin copy (master={master_ind_id})", flush=True)
                continue
            score = score_map.get(code)
            if score is None:
                score = float(ind.get("value") or 1) if rating_raw == "met" else 0.0
            execute(
                """INSERT INTO meeting_session_scores
                   (meeting_id, session_id, indicator_id, score, score_type, comment, reviewer_id)
                   VALUES (%s, %s, %s, %s, 'AI', %s, NULL)""",
                (meeting_id, session_id, admin_ind_id, float(score), ind.get("benchmark") or (entry.get("reason") or "")),
            )
            mss_count += 1

        return {
            "submitted": submitted,
            "overall_percentage": overall_pct,
            "gate_status": gate_status,
            "red_flag": red_flag,
            "summary": overall_summary,
            "ai_audit_results": len(ai_rows),
            "meeting_session_scores": mss_count,
            "session_analysis": 1,
        }



    # ==========================================================
    # MAIN ENTRY
    # ==========================================================
    def generate_evaluation(self, transcript_text, session_id, meeting_id=None, prompt_output_path=None):
        """Run the full tutor evaluation: prompt -> AI -> cache -> compute -> persist."""
        transcript_text = (transcript_text or "").strip()
        if not transcript_text:
            raise TutorEvaluationError("transcript_text is required")

        raw_rubric = RubricLoader().load_rubric()

        system_instruction = self._build_system_instruction()
        prompt = self._build_prompt(raw_rubric, transcript_text)

        # Persist EXACT request before the call (survives failure)
        self._save_eval_file(
            prompt_output_path, meeting_id, session_id,
            system_instruction, prompt, raw_response=None, status="PENDING",
        )

        raw_response = self.ai_api.ask_ai(prompt=prompt, system_instruction=system_instruction)

        # Persist EXACT raw response after the call
        self._save_eval_file(
            prompt_output_path, meeting_id, session_id,
            system_instruction, prompt, raw_response=raw_response, status="OK",
        )

        # Parse
        try:
            clean = re.sub(r"^```(?:json)?\s*|```\s*$", "", raw_response.strip(), flags=re.IGNORECASE)
            parsed = json.loads(clean)
        except Exception as e:
            raise TutorEvaluationError(f"Failed to parse AI response as JSON: {e}")

        # Compute in code (trusted math)
        computed = self._compute_percentages(raw_rubric, parsed)

        # Re-save with computed block (non-destructive update)
        self._save_eval_file(
            prompt_output_path, meeting_id, session_id,
            system_instruction, prompt, raw_response=raw_response, status="OK",
            computed=computed,
        )

        # ---- SECOND AI CALL: session analysis + per-indicator scores ----
        analysis = {}
        try:
            analysis_instruction = self._build_analysis_system_instruction()
            analysis_prompt = self._build_analysis_prompt(raw_rubric, parsed, transcript_text)
            self._save_eval_file(
                prompt_output_path, meeting_id, session_id,
                system_instruction, prompt, raw_response=None, status="OK",
                computed=computed,
                analysis_instruction=analysis_instruction,
                analysis_prompt=analysis_prompt,
                analysis_response=None,
            )
            analysis_raw = self.ai_api.ask_ai(prompt=analysis_prompt, system_instruction=analysis_instruction)
            # Persist the 2nd EXACT response
            self._save_eval_file(
                prompt_output_path, meeting_id, session_id,
                system_instruction, prompt, raw_response=raw_response, status="OK",
                computed=computed,
                analysis_instruction=analysis_instruction,
                analysis_prompt=analysis_prompt,
                analysis_response=analysis_raw,
            )
            clean2 = re.sub(r"^```(?:json)?\s*|```\s*$", "", analysis_raw.strip(), flags=re.IGNORECASE)
            analysis = json.loads(clean2) if isinstance(json.loads(clean2), dict) else {}
        except Exception as e:
            print(f"[TUTOR EVAL] WARNING: Second analysis call failed, continuing without it: {e}", flush=True)

        persisted = self._persist(
            session_id, meeting_id, raw_rubric, parsed, computed,
            raw_response_text=raw_response,
            evidence_quote=parsed.get("evidence_quote"),
            analysis=analysis,
        )

        return {
            "success": True,
            "session_id": session_id,
            "meeting_id": meeting_id,
            "prompt_output_path": prompt_output_path,
            "overall_percentage": computed["overall_percentage"],
            "category_percentages": computed["category_percentages"],
            "red_flag": persisted["red_flag"],
            "summary": persisted["summary"],
            "persisted": persisted,
        }
