# root/services/engine/ai_audit_service/audit_worker.py

import json
import os
import re
import sys
import time
import traceback
from decimal import Decimal
from database.python_db import get_cursor, execute, fetch_all
from services.engine.ai_audit_service.rubric_loader import RubricLoader


_AUDIT_SYSTEM_INSTRUCTION = """Evaluate the tutoring transcript against the supplied indicators. Output ONLY JSON:
{"scores":{"A1.1":{"s":1,"e":"quote"},"A1.2":{"s":0,"r":"reason","e":"quote"},"A1.4":{"s":null,"r":"partial session"}},"gate_failures":[],"evidence_quote":"best quote"}
Rules: 1=Met, 0=Not Met, null=Not applicable/insufficient evidence. Score 0 for observed failures. Gates with s=0 go in gate_failures; null never counts. ASR errors → treat as intended word, don't penalize. Cite ≤12-word evidence; for 0/null add a ≤15-word reason."""


def _json_default(o):
    """json.dumps default handler: convert non-serializable types (Decimal etc.)."""
    if isinstance(o, Decimal):
        return float(o)
    return str(o)


def _derive_rating(ai_score, ai_max):
    """
    Derive a Met / Partial / Not met / N/A rating from a numeric score + max so
    the rating column is populated even when the AI omits an explicit rating.
    score is None (excluded/video-gated) -> N/A; >= max -> Met; == 0 -> Not met.
    """
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

class AuditWorker:

    def evaluate(self, transcript, talk_ratio):
        transcript = transcript or ""
        word_count = len(transcript.split())

        has_questions = "?" in transcript
        has_objective_language = any(
            token in transcript.lower()
            for token in ["objective", "goal", "today", "learn"]
        )

        domain_scores = {
            "Transcript Completeness": 100.0 if word_count else 0.0,
            "Instructional Signals": 100.0 if has_objective_language else 50.0,
            "Interaction Signals": 100.0 if has_questions else 50.0
        }

        oqi_score = round(sum(domain_scores.values()) / len(domain_scores), 2)

        return {
            "domain_scores": domain_scores,
            "oqi_score": oqi_score,
            "evidence_quote": transcript[:300],
            "talk_ratio": talk_ratio or {}
        }


class AiAuditService:
    def __init__(self, ai_config):
        from services.engine.ai_api_service import AiApiService
        self.ai_api = AiApiService(ai_config)

    def _load_rubric_schema(self, admin_user_id=None):
        """
        Load rubric schema from admin_rubric_categories and admin_rubric_indicators
        when admin_user_id is provided, otherwise fall back to master tables.
        """
        print("[AUDIT MICROSERVICE] Status: Opening database stream...", file=sys.stderr, flush=True)
        try:
            with get_cursor() as cursor:
                if admin_user_id:
                    print(f"[AUDIT MICROSERVICE] Status: Loading admin-specific rubric for admin_user_id={admin_user_id}...", flush=True)
                    cursor.execute(
                        "SELECT original_category_id, name, weight FROM admin_rubric_categories WHERE admin_user_id = %s",
                        (admin_user_id,)
                    )
                    categories = cursor.fetchall()

                    schema = []
                    for cat in categories:
                        cat_dict = {
                            "category": cat["name"],
                            "weight": cat["weight"],
                            "category_id": cat["original_category_id"],
                            "indicators": []
                        }
                        cursor.execute(
                            "SELECT original_indicator_id, name, type, is_gate, value FROM admin_rubric_indicators WHERE admin_user_id = %s AND original_category_id = %s",
                            (admin_user_id, cat["original_category_id"])
                        )
                        indicators = cursor.fetchall()
                        for ind in indicators:
                            cat_dict["indicators"].append({
                                "indicator_id": ind["original_indicator_id"],
                                "name": ind["name"],
                                "type": ind["type"] or "AI",
                                "is_gate": bool(ind["is_gate"]),
                                "value": ind["value"] or 1
                            })
                        schema.append(cat_dict)

                    if not schema:
                        print("[AUDIT MICROSERVICE] WARNING: No admin-specific rubric found. Falling back to master rubric.", flush=True)
                        schema = self._load_master_rubric_schema(cursor)
                    else:
                        print("[AUDIT MICROSERVICE] Status: Admin-specific rubric parameters successfully cached.", flush=True)
                else:
                    print("[AUDIT MICROSERVICE] Status: Loading master rubric...", flush=True)
                    schema = self._load_master_rubric_schema(cursor)

            return schema
        except Exception as e:
            print(f"[AUDIT MICROSERVICE] WARNING: DB read failed ({str(e)}). Deploying structural fallbacks.", flush=True)
            return [{
                "category": "General Performance",
                "weight": 1.0,
                "category_id": "gen_perf",
                "indicators": [{
                    "indicator_id": "gen_overall",
                    "name": "Overall Quality",
                    "type": "AI",
                    "is_gate": False,
                    "value": 1
                }]
            }]

    def _load_master_rubric_schema(self, cursor):
        """Load rubric from master rubric_categories and rubric_indicators tables."""
        cursor.execute("SELECT id, category_code, name, weight FROM rubric_categories")
        categories = cursor.fetchall()

        schema = []
        for cat in categories:
            cat_dict = {
                "category": cat["name"],
                "weight": cat["weight"],
                "category_id": cat["category_code"],  # code e.g. 'A'
                "category_id_pk": cat["id"],          # numeric rubric_categories.id
                "indicators": []
            }
            cursor.execute(
                "SELECT id, indicator_code, subgroup_name, name, type, is_gate, value, benchmark, requires_video FROM rubric_indicators WHERE category_id = %s",
                (cat["id"],)
            )
            indicators = cursor.fetchall()
            for ind in indicators:
                cat_dict["indicators"].append({
                    "indicator_id": ind["indicator_code"],  # code e.g. 'A1.1'
                    "indicator_id_pk": ind["id"],           # numeric rubric_indicators.id
                    "subgroup_name": ind.get("subgroup_name"),
                    "name": ind["name"],
                    "type": ind["type"] or "AI",
                    "is_gate": bool(ind["is_gate"]),
                    "value": ind["value"] or 1,
                    "benchmark": ind.get("benchmark"),
                    "requires_video": bool(ind.get("requires_video"))
                })
            schema.append(cat_dict)

        print("[AUDIT MICROSERVICE] Status: Master rubric parameters successfully cached.", flush=True)
        return schema

    def _build_rubric_schema_from_loader(self, raw_rubric):
        """
        Convert the flat {categories, indicators} dict from RubricLoader
        into the nested list-of-category-dicts that _store_audit_results expects.
        """
        ind_by_cat = {}
        for ind in raw_rubric["indicators"]:
            ind_by_cat.setdefault(ind["category_id"], []).append(ind)  # numeric FK

        return [
            {
                "category": cat["name"],
                "weight": cat["weight"],
                "category_id": cat["category_code"],   # code e.g. 'A'
                "category_id_pk": cat.get("id"),       # numeric rubric_categories.id
                "indicators": [
                    {
                        "indicator_id": ind["indicator_code"],       # code e.g. 'A1.1'
                        "indicator_id_pk": ind.get("id"),             # numeric rubric_indicators.id
                        "subgroup_name": ind.get("subgroup_name"),
                        "name": ind["name"],
                        "type": ind.get("type") or "AI",
                        "is_gate": bool(ind.get("is_gate")),
                        "value": ind.get("value") or 1,
                        "benchmark": ind.get("benchmark"),
                        "requires_video": bool(ind.get("requires_video"))
                    }
                    for ind in ind_by_cat.get(cat["id"], [])
                ]
            }
            for cat in raw_rubric["categories"]
        ]

    def _build_compact_prompt(self, rubric_schema, transcript_text):
        """
        Build a small prompt: one line per scorable (non-video) indicator as
        `code|gate|benchmark`. Category weights are NOT sent — they are used only
        in post-processing (code) to compute the final score, so sending them
        would only waste tokens. Video-only indicators are omitted entirely so
        the LLM never sees them (they are re-inserted with an explicit N/A in
        code afterwards).
        """
        ind_lines = ["INDICATORS (code|gate|benchmark):"]
        for cat in rubric_schema:
            for ind in cat.get("indicators", []):
                if ind.get("requires_video"):
                    continue
                ind_code = ind.get("indicator_id")
                gate = "G" if ind.get("is_gate") else "."
                benchmark = (ind.get("benchmark") or "").strip()
                ind_lines.append(f"{ind_code}|{gate}|{benchmark}")

        return (
            "\n".join(ind_lines)
            + "\n\nTranscript:\n"
            + transcript_text
        )

    def _expand_compact_result(self, rubric_schema, compact):
        """
        Expand the compact LLM response (scores keyed by indicator code) into the
        named per-category structure downstream expects, and do ALL the math in
        code (category score, scored/excluded counts, weighted oqi_score).

        - Re-inserts video-only indicators as score=null / rating N/A.
        - Remaps s/e/r back to score/evidence/reason.
        - Re-attaches category + indicator names.
        - Recomputes gate_failures from scores (never trusts the LLM's math).
        """
        raw_scores = compact.get("scores") if isinstance(compact.get("scores"), dict) else {}
        evidence_quote = compact.get("evidence_quote", "") or ""

        def norm_score(v):
            if isinstance(v, str):
                v = v.strip().lower()
                if v in ("null", "none", ""):
                    return None
                try:
                    v = float(v)
                except (TypeError, ValueError):
                    return None
            if v is None:
                return None
            try:
                return int(round(float(v)))
            except (TypeError, ValueError):
                return None

        category_scores = {}
        gate_set = set()
        num = 0.0
        den = 0.0

        for cat in rubric_schema:
            cat_name = cat.get("category")
            weight = float(cat.get("weight") or 0)
            indicators_out = {}
            scored_count = 0
            excluded_count = 0
            score_sum = 0.0

            for ind in cat.get("indicators", []):
                code = ind.get("indicator_id")
                name = ind.get("name")
                requires_video = bool(ind.get("requires_video"))
                is_gate = bool(ind.get("is_gate"))

                entry = raw_scores.get(code)
                score = None
                reason = ""
                evidence = ""
                if isinstance(entry, dict):
                    score = norm_score(entry.get("s"))
                    reason = str(entry.get("r") or "").strip()
                    evidence = str(entry.get("e") or "").strip()
                elif entry is not None:
                    score = norm_score(entry)

                if score is not None:
                    # Coerce any abnormal s to binary 0/1 (0 < score < 1 rounds to 0).
                    score = 1 if score >= 1 else 0
                    scored_count += 1
                    score_sum += score
                    if is_gate and score == 0:
                        gate_set.add(code)
                else:
                    excluded_count += 1
                    if requires_video:
                        reason = reason or "requires video"
                        evidence = "requires video"
                    elif not reason:
                        reason = "not observable from the provided transcript"

                rating = "Met" if score == 1 else ("Not met" if score == 0 else "N/A")

                indicators_out[name] = {
                    "indicator": code,
                    "indicator_id": code,
                    "question": name,
                    "rubric_id": code,
                    "score": score,
                    "max_score": 1,
                    "rating": rating,
                    "reason": reason or None,
                    "evidence": evidence,
                    "requires_video": requires_video,
                }

            cat_pct = round(score_sum / scored_count * 100, 2) if scored_count else None
            category_scores[cat_name] = {
                "score": cat_pct,
                "scored": scored_count,
                "excluded": excluded_count,
                "scored_indicator_count": scored_count,
                "excluded_indicator_count": excluded_count,
                "indicators": indicators_out,
            }
            if cat_pct is not None:
                num += cat_pct * weight
                den += weight

        oqi_score = round(num / den, 2) if den else 0.0

        return {
            "category_scores": category_scores,
            "oqi_score": oqi_score,
            "gate_failures": sorted(gate_set),
            "evidence_quote": evidence_quote,
        }

    def _save_prompt_file(self, prompt_output_path, meeting_id, session_id,
                          system_instruction, prompt, talk_ratio,
                          raw_response=None, status="PENDING"):
        """
        Persist the EXACT request sent to the AI and the EXACT raw response
        returned by the AI into a single structured JSON file under
        storage/cache_llm_prompts/PROMPT_AUDIT_<id>.json.

        - 'request' holds the exact payload that was sent to the AI:
            - "system_instruction" — the system rules,
            - "prompt" — the user message (indicator list + transcript),
            - "replayable_prompt" — the full combined text (system + user) you can
              paste into a chat box to reproduce the same response.
        - 'response' holds the exact raw text the AI returned (status OK once
          the call completed, PENDING while the call has not returned yet).
        """
        if not prompt_output_path:
            return
        try:
            os.makedirs(os.path.dirname(prompt_output_path) or ".", exist_ok=True)
            model = None
            try:
                model = self.ai_api.model
            except Exception:
                model = None

            payload = {
                "task": "audit",
                "provider": self.ai_api.provider,
                "model": model,
                "meeting_id": meeting_id,
                "session_id": session_id,
                "request": {
                    "system_instruction": system_instruction,
                    "prompt": prompt,
                    # Full combined prompt for copy-pasting into a chat UI.
                    "replayable_prompt": f"{system_instruction}\n\n{prompt}"
                },
                "response": {
                    "status": status,
                    "raw_response": raw_response
                },
                "talk_ratio": talk_ratio or {}
            }

            with open(prompt_output_path, "w", encoding="utf-8") as pf:
                json.dump(payload, pf, indent=2, ensure_ascii=False, default=_json_default)

            print(
                f"[AUDIT MICROSERVICE] Status: Prompt + AI response saved to {prompt_output_path}",
                flush=True
            )
        except Exception as prompt_write_err:
            print(
                f"[AUDIT MICROSERVICE] WARNING: Could not save prompt file: {prompt_write_err}",
                flush=True
            )

    def process_audit(self, transcript_text, meeting_id=None, session_id=None, talk_ratio=None, prompt_output_path=None):
        """
        Process audit: load rubric schema, send to AI for scoring,
        store results per-indicator in the database, and return the full audit result.
        """
        raw_rubric = RubricLoader().load_rubric()

        # Nested schema for _store_audit_results; flat raw_rubric for the AI prompt
        rubric_schema = self._build_rubric_schema_from_loader(raw_rubric)

        print("[AUDIT MICROSERVICE] Status: Structuring evaluation instruction maps...", flush=True)

        system_instruction = _AUDIT_SYSTEM_INSTRUCTION

        prompt = self._build_compact_prompt(rubric_schema, transcript_text)
        print(f"[AUDIT MICROSERVICE] Status: Sending payload data to '{self.ai_api.provider.upper()}' engine...", flush=True)

        # Persist the EXACT request sent to AI (system_instruction + full rubric
        # + transcript) to storage/cache_llm_prompts/PROMPT_AUDIT_<id>.json.
        # Written before the call so the prompt is preserved even if AI fails;
        # the exact AI response is appended after ask_ai returns below.
        self._save_prompt_file(
            prompt_output_path,
            meeting_id,
            session_id,
            system_instruction,
            prompt,
            talk_ratio,
            raw_response=None,
            status="PENDING",
        )

        for progress_pct in range(10, 91, 20):
            print(f"[AUDIT MICROSERVICE] Progress: AI Evaluation {progress_pct}% pending validation...", flush=True)
            time.sleep(0.2)

        raw_response = self.ai_api.ask_ai(prompt=prompt, system_instruction=system_instruction)

        # Persist the EXACT raw AI response into the same prompt file so the
        # stored file always mirrors what the AI actually returned (and matches
        # the recorded request, so it can be replayed).
        self._save_prompt_file(
            prompt_output_path,
            meeting_id,
            session_id,
            system_instruction,
            prompt,
            talk_ratio,
            raw_response=raw_response,
            status="OK",
        )

        try:
            clean_json = re.sub(r'^```(?:json)?\s*|```\s*$', '', raw_response.strip(), flags=re.IGNORECASE).strip()

            # Robust extraction: LLM responses occasionally wrap the JSON in
            # prose or leave trailing text after a code fence. If a bare parse
            # fails, slice the JSON object between the first "{" and the last "}"
            # and parse that instead, so a stray suffix never kills the audit.
            try:
                result = json.loads(clean_json)
            except Exception:
                start = clean_json.find("{")
                end = clean_json.rfind("}")
                if start != -1 and end != -1 and end > start:
                    result = json.loads(clean_json[start:end + 1])
                else:
                    raise

            print("[AUDIT MICROSERVICE] Progress: Evaluation 100% complete! Metrics isolated.", flush=True)
        except Exception as e:
            print(f"[AUDIT MICROSERVICE] ERROR: JSON Parse Failed: {type(e).__name__}: {str(e)}", flush=True)

            print("========== RAW AI RESPONSE START ==========", flush=True)
            print(raw_response, flush=True)
            print("========== RAW AI RESPONSE END ==========", flush=True)

            traceback.print_exc()

            result = {
                "category_scores": {
                    "Uncategorized": {
                        "score": 0.0,
                        "indicators": {
                            "Unknown": {
                                "score": 0,
                                "max_score": 0,
                                "evidence": "Parse failure"
                            }
                        }
                    }
                },
                "domain_scores": {"Uncategorized": 0.0},
                "oqi_score": 0.0,
                "evidence_quote": "Process failure during schema conversion optimization.",
                "error_log": str(e)
            }

        # Expand the compact LLM response (scores keyed by code) into the named
        # per-category structure downstream expects, and compute all math in code.
        if isinstance(result, dict) and isinstance(result.get("scores"), dict):
            result = self._expand_compact_result(rubric_schema, result)

        if meeting_id:
            self._store_audit_results(
                meeting_id=meeting_id,
                session_id=session_id,
                rubric_schema=rubric_schema,
                ai_result=result,
                talk_ratio=talk_ratio
            )
        else:
            print("[AUDIT MICROSERVICE] WARNING: meeting_id not provided. Skipping database storage.", flush=True)

        return result

    def _store_audit_results(self, meeting_id, session_id, rubric_schema, ai_result, talk_ratio=None):
        """
        Store per-indicator AI audit results in the ai_audit_results table.
        Matches AI response indicators against the rubric schema to store
        each indicator's score against its category_id and indicator_id.
        """
        print(f"[AUDIT MICROSERVICE] Status: Storing audit results for meeting_id={meeting_id}...", flush=True)
        try:
            oqi_score = ai_result.get("oqi_score", 0.0)
            evidence_quote = ai_result.get("evidence_quote", "")
            talk_ratio_json = json.dumps(talk_ratio or {})
            raw_response = json.dumps(ai_result)

            category_scores = ai_result.get("category_scores", {})
            domain_scores = ai_result.get("domain_scores", {})

            # Build lookup: category_name -> { category_id (numeric), weight, indicators }
            rubric_lookup = {}
            for cat in rubric_schema:
                cat_name = cat["category"]
                rubric_lookup[cat_name] = {
                    "category_id": cat.get("category_id", ""),   # code e.g. 'A'
                    "category_id_pk": cat.get("category_id_pk"), # numeric rubric_categories.id
                    "weight": cat.get("weight", 0),
                    "indicators": {}
                }
                for ind in cat.get("indicators", []):
                    ind_name = ind["name"] if isinstance(ind, dict) else ind
                    if isinstance(ind, dict):
                        rubric_lookup[cat_name]["indicators"][ind_name] = {
                            "indicator_id": ind.get("indicator_id", ""),       # code e.g. 'A1.1'
                            "indicator_id_pk": ind.get("indicator_id_pk"),     # numeric rubric_indicators.id
                            "type": ind.get("type", "AI"),
                            "value": ind.get("value", 1)
                        }
                    else:
                        rubric_lookup[cat_name]["indicators"][ind_name] = {
                            "indicator_id": "",
                            "indicator_id_pk": None,
                            "type": "AI",
                            "value": 1
                        }

            # Flat lookup of the rubric schema by indicator name so we can write
            # is_gate / benchmark / value (rubric_lookup only keeps value/type).
            schema_by_indicator = {}
            for cat in rubric_schema:
                for ind in cat.get("indicators", []):
                    ind_key = ind["name"] if isinstance(ind, dict) else ind
                    schema_by_indicator[ind_key] = ind

            # Clear previous audit results for this meeting and session
            execute(
                "DELETE FROM ai_audit_results WHERE meeting_id = %s AND session_id = %s",
                (meeting_id, session_id)
            )

            indicator_count = 0

            # Primary path: new category_scores format from AI
            if category_scores:
                for cat_name, cat_data in category_scores.items():
                    # Resolve category numeric id from rubric lookup
                    category_id = ""
                    if cat_name in rubric_lookup:
                        category_id = rubric_lookup[cat_name].get("category_id_pk") or rubric_lookup[cat_name]["category_id"]
                    else:
                        for rubric_cat_name, rubric_cat in rubric_lookup.items():
                            if rubric_cat_name.lower() in cat_name.lower() or cat_name.lower() in rubric_cat_name.lower():
                                category_id = rubric_cat.get("category_id_pk") or rubric_cat["category_id"]
                                break

                    indicators_data = cat_data.get("indicators", {}) if isinstance(cat_data, dict) else {}

                    for ind_name, ind_data in indicators_data.items():
                        ai_score = None
                        ai_max = 2
                        indicator_id = ""
                        ind_ref = None
                        category_weight = 0.0

                        if isinstance(ind_data, dict):
                            raw_score = ind_data.get("score")
                            raw_max = ind_data.get("max_score") or ind_data.get("value")
                            try:
                                # score: null means "excluded from aggregation" (e.g. a
                                # video-gated indicator not scorable from a transcript).
                                # Store NULL, never coerced to 0, so it isn't penalized.
                                ai_score = None if raw_score is None else float(raw_score)
                                ai_max = float(raw_max) if raw_max is not None else 2.0
                            except (TypeError, ValueError):
                                ai_score = None if raw_score is None else 0.0
                                ai_max = 2.0
                        elif isinstance(ind_data, (int, float)):
                            ai_score = float(ind_data)

                        for rubric_cat in rubric_lookup.values():
                            if ind_name in rubric_cat["indicators"]:
                                ind_ref = rubric_cat["indicators"][ind_name]
                                indicator_id = ind_ref.get("indicator_id_pk") or ind_ref["indicator_id"]
                                category_weight = float(rubric_cat.get("weight") or 0)
                                break

                        ind_meta = schema_by_indicator.get(ind_name) or {}
                        if ind_ref:
                            indicator_value = ind_meta.get("value")
                            if indicator_value is None:
                                indicator_value = ind_ref.get("value", 1)
                        else:
                            indicator_value = 1
                        indicator_is_gate = 1 if ind_meta.get("is_gate") else 0
                        benchmark = ind_meta.get("benchmark")

                        ai_evidence = ""
                        ai_rating = None
                        ai_reason = None
                        if isinstance(ind_data, dict):
                            ai_evidence = ind_data.get("evidence") or ""
                            ai_rating = ind_data.get("rating")
                            ai_reason = ind_data.get("reason")

                        # Prefer the AI-provided rating/reason; fall back to a
                        # derived rating from the numeric score when the AI omits it.
                        rating = _derive_rating(ai_score, ai_max)
                        if ai_rating and str(ai_rating).strip().lower() in (
                            "met", "not met", "not applicable", "partial", "na", "n/a",
                        ):
                            rating = str(ai_rating).strip()
                        reason = (ai_reason or ai_evidence or "").strip() or None
                        indicator_name = ind_name

                        print(f"[AUDIT DEBUG] ind_name={ind_name} | ind_data={ind_data} | ai_score={ai_score} | ai_max={ai_max} | rating={rating}", flush=True)

                        execute(
                            """INSERT INTO ai_audit_results
                               (meeting_id, session_id, category_id, indicator_id,
                                category_name, category_weight, indicator_name, indicator_value, is_gate,
                                ai_score, ai_max_score, ai_evidence, rating, reason, benchmark,
                                ai_raw_response, oqi_score, evidence_quote, talk_ratio)
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
                            (
                                meeting_id, session_id,
                                category_id, indicator_id,
                                cat_name, category_weight, indicator_name, float(indicator_value), indicator_is_gate,
                                ai_score, ai_max, ai_evidence, rating, reason, benchmark,
                                raw_response, oqi_score,
                                evidence_quote, talk_ratio_json
                            )
                        )
                        indicator_count += 1

            # Fallback: old domain_scores format
            if indicator_count == 0 and domain_scores:
                for cat_name, score in domain_scores.items():
                    category_id = rubric_lookup.get(cat_name, {}).get("category_id", "")

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
                            category_id, cat_name,
                            score, 2, raw_response, oqi_score,
                            evidence_quote, talk_ratio_json
                        )
                    )
                    indicator_count += 1

            print(f"[AUDIT MICROSERVICE] Status: Successfully stored {indicator_count} indicator results in ai_audit_results table.", flush=True)

        except Exception as e:
            print(f"[AUDIT MICROSERVICE] ERROR: Failed to store audit results in database: {str(e)}", flush=True)
            traceback.print_exc()
