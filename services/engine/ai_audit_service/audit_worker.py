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


def _json_default(o):
    """json.dumps default handler: convert non-serializable types (Decimal etc.)."""
    if isinstance(o, Decimal):
        return float(o)
    return str(o)

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

    def _save_prompt_file(self, prompt_output_path, meeting_id, session_id,
                          system_instruction, prompt, talk_ratio,
                          raw_response=None, status="PENDING"):
        """
        Persist the EXACT request sent to the AI and the EXACT raw response
        returned by the AI into a single structured JSON file under
        storage/cache_llm_prompts/PROMPT_AUDIT_<id>.json.

        - 'request' holds the exact payload that was sent to the AI
          (system_instruction + user prompt, the OpenAI 'messages' array, and
          a single 'replayable_prompt' string that can be copy-pasted directly
          into a chat UI to reproduce the same response).
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

            messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt},
            ]

            payload = {
                "task": "audit",
                "provider": self.ai_api.provider,
                "model": model,
                "meeting_id": meeting_id,
                "session_id": session_id,
                "request": {
                    "system_instruction": system_instruction,
                    "prompt": prompt,
                    "messages": messages,
                    # Exact combined prompt you can paste into a chat box to
                    # reproduce the same AI response.
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

        system_instruction = (
            "You are an isolated QA evaluation microservice. Score the transcript text against the provided rubric parameters.\n\n"
            "INPUT MODE: This evaluation is being run on AUDIO/TRANSCRIPT ONLY. No video feed is available.\n\n"
            "RULES:\n"
            "1. For each category and its indicators, you MUST return a per-indicator result.\n"
            '2. Each indicator has a "benchmark" describing what a passing session looks like — use it as your scoring standard instead of inferring from the name alone.\n'
            '3. Each indicator has a "requires_video" flag.\n'
            '   - If requires_video is true: you CANNOT score this indicator from a transcript alone. Set "score" to null, "max_score" to the indicator\'s value, and set "evidence" to "Not scorable from transcript — requires video." Do NOT guess or assume a score for these indicators under any circumstance.\n'
            '   - If requires_video is false: score normally from 0 to its value, using the benchmark as your standard, and cite the specific line(s) of transcript that justify the score.\n'
            '4. Calculate each category\'s score as a weighted average using ONLY the indicators that were actually scored (score is not null) within that category. Indicators with a null score must be excluded from both the numerator and denominator of the category average — do not treat them as 0.\n'
            "5. Calculate the overall weighted OQI score (0–100) from the category scores and their weights, using the same exclusion rule if an entire category has no scorable indicators.\n"
            '6. Note any indicator marked "gate": true and scored 0 in a separate "gate_failures" array in your response, listing the indicator_id.\n'
            "7. You must return ONLY a raw JSON string matching this structure exactly. No conversational text, no markdown wrappers, no code fences:\n"
            "{\n"
            '  "category_scores": {\n'
            '    "Category Name": {\n'
            '      "score": 85.0,\n'
            '      "scored_indicator_count": 10,\n'
            '      "excluded_indicator_count": 2,\n'
            '      "indicators": {\n'
            '        "Indicator Name": { "score": 2, "max_score": 2, "evidence": "brief reason citing the transcript, or note" }\n'
            "      }\n"
            "    }\n"
            "  },\n"
            '  "oqi_score": 85.0,\n'
            '  "gate_failures": ["A3.1"],\n'
            '  "evidence_quote": "Exact string excerpt from text proving evaluation matrix"\n'
            "}"
        )

        prompt = f"Rubric Target Rules:\n{json.dumps(raw_rubric, indent=2, default=_json_default)}\n\nTranscript Target Data:\n{transcript_text}"
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
            clean_json = re.sub(r'^```(?:json)?\s*|```\s*$', '', raw_response.strip(), flags=re.IGNORECASE)
            result = json.loads(clean_json)
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
                                break

                        print(f"[AUDIT DEBUG] ind_name={ind_name} | ind_data={ind_data} | ai_score={ai_score} | ai_max={ai_max}", flush=True)

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
                                category_id, indicator_id,
                                ai_score, ai_max, raw_response, oqi_score,
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
