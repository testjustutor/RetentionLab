# root/services/engine/ai_audit_service/audit_worker.py

import json
import sqlite3
import re
import sys
import time
import traceback
from services.engine.ai_audit_service.rubric_loader import RubricLoader


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
    def __init__(self, db_path, ai_config):
        from services.engine.ai_api_service import AiApiService
        self.db_path = db_path
        self.ai_api = AiApiService(ai_config)

    def _load_rubric_schema(self, admin_user_id=None):
        """
        Load rubric schema from admin_rubric_categories and admin_rubric_indicators
        when admin_user_id is provided, otherwise fall back to master tables.
        """
        print("[AUDIT MICROSERVICE] Status: Opening local database stream...", file=sys.stderr, flush=True)
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            if admin_user_id:
                print(f"[AUDIT MICROSERVICE] Status: Loading admin-specific rubric for admin_user_id={admin_user_id}...", flush=True)
                cursor.execute(
                    "SELECT original_category_id, name, weight FROM admin_rubric_categories WHERE admin_user_id = ?",
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
                        "SELECT original_indicator_id, name, type, is_gate, value FROM admin_rubric_indicators WHERE admin_user_id = ? AND original_category_id = ?",
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

            conn.close()
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
        cursor.execute("SELECT category_id, name, weight FROM rubric_categories")
        categories = cursor.fetchall()

        schema = []
        for cat in categories:
            cat_dict = {
                "category": cat["name"],
                "weight": cat["weight"],
                "category_id": cat["category_id"],
                "indicators": []
            }
            cursor.execute(
                "SELECT indicator_id, name, type, is_gate, value FROM rubric_indicators WHERE category_id = ?",
                (cat["category_id"],)
            )
            indicators = cursor.fetchall()
            for ind in indicators:
                cat_dict["indicators"].append({
                    "indicator_id": ind["indicator_id"],
                    "name": ind["name"],
                    "type": ind["type"] or "AI",
                    "is_gate": bool(ind["is_gate"]),
                    "value": ind["value"] or 1
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
            ind_by_cat.setdefault(ind["category_id"], []).append(ind)

        return [
            {
                "category": cat["name"],
                "weight": cat["weight"],
                "category_id": cat["category_id"],
                "indicators": [
                    {
                        "indicator_id": ind["indicator_id"],
                        "name": ind["name"],
                        "type": ind.get("type") or "AI",
                        "is_gate": bool(ind.get("is_gate")),
                        "value": ind.get("value") or 1
                    }
                    for ind in ind_by_cat.get(cat["category_id"], [])
                ]
            }
            for cat in raw_rubric["categories"]
        ]

    def process_audit(self, transcript_text, meeting_id=None, session_id=None, talk_ratio=None):
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
            "For each category and its indicators, you MUST return per-indicator scores.\n"
            "Each indicator has a 'value' field (max score). Score each indicator from 0 to its value.\n"
            "Calculate category scores as weighted averages.\n"
            "Calculate an overall weighted OQI score from 0 to 100.\n\n"
            "You must return ONLY a raw JSON string matching this structure exactly. No conversational text, no markdown wrappers:\n"
            "{\n"
            '  "category_scores": {\n'
            '    "Category Name": {\n'
            '      "score": 85.0,\n'
            '      "indicators": {\n'
            '        "Indicator Name": { "score": 2, "max_score": 2, "evidence": "brief reason" }\n'
            "      }\n"
            "    }\n"
            "  },\n"
            '  "oqi_score": 85.0,\n'
            '  "evidence_quote": "Exact string excerpt from text proving evaluation matrix"\n'
            "}"
        )

        prompt = f"Rubric Target Rules:\n{json.dumps(raw_rubric, indent=2)}\n\nTranscript Target Data:\n{transcript_text}"
        print(f"[AUDIT MICROSERVICE] Status: Sending payload data to '{self.ai_api.provider.upper()}' engine...", flush=True)

        for progress_pct in range(10, 91, 20):
            print(f"[AUDIT MICROSERVICE] Progress: AI Evaluation {progress_pct}% pending validation...", flush=True)
            time.sleep(0.2)

        raw_response = self.ai_api.ask_ai(prompt=prompt, system_instruction=system_instruction)

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
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            oqi_score = ai_result.get("oqi_score", 0.0)
            evidence_quote = ai_result.get("evidence_quote", "")
            talk_ratio_json = json.dumps(talk_ratio or {})
            raw_response = json.dumps(ai_result)

            category_scores = ai_result.get("category_scores", {})
            domain_scores = ai_result.get("domain_scores", {})

            # Build lookup: category_name -> { category_id, weight, indicators }
            rubric_lookup = {}
            for cat in rubric_schema:
                cat_name = cat["category"]
                rubric_lookup[cat_name] = {
                    "category_id": cat.get("category_id", ""),
                    "weight": cat.get("weight", 0),
                    "indicators": {}
                }
                for ind in cat.get("indicators", []):
                    ind_name = ind["name"] if isinstance(ind, dict) else ind
                    if isinstance(ind, dict):
                        rubric_lookup[cat_name]["indicators"][ind_name] = {
                            "indicator_id": ind.get("indicator_id", ""),
                            "type": ind.get("type", "AI"),
                            "value": ind.get("value", 1)
                        }
                    else:
                        rubric_lookup[cat_name]["indicators"][ind_name] = {
                            "indicator_id": "",
                            "type": "AI",
                            "value": 1
                        }

            # Clear previous audit results for this meeting and session
            cursor.execute(
                "DELETE FROM ai_audit_results WHERE meeting_id = ? AND session_id = ?",
                (meeting_id, session_id)
            )

            indicator_count = 0

            # Primary path: new category_scores format from AI
            if category_scores:
                for cat_name, cat_data in category_scores.items():
                    # Resolve category_id from rubric lookup
                    category_id = ""
                    if cat_name in rubric_lookup:
                        category_id = rubric_lookup[cat_name]["category_id"]
                    else:
                        for rubric_cat_name, rubric_cat in rubric_lookup.items():
                            if rubric_cat_name.lower() in cat_name.lower() or cat_name.lower() in rubric_cat_name.lower():
                                category_id = rubric_cat["category_id"]
                                break

                    indicators_data = cat_data.get("indicators", {}) if isinstance(cat_data, dict) else {}

                    for ind_name, ind_data in indicators_data.items():
                        ai_score = 0
                        ai_max = 2
                        indicator_id = ""

                        if isinstance(ind_data, dict):
                            raw_score = ind_data.get("score") or ind_data.get("value") or 0
                            raw_max = ind_data.get("max_score") or ind_data.get("value") or 2
                            try:
                                ai_score = float(raw_score)
                                ai_max = float(raw_max)
                            except (TypeError, ValueError):
                                ai_score = 0.0
                                ai_max = 2.0
                        elif isinstance(ind_data, (int, float)):
                            ai_score = float(ind_data)

                        for rubric_cat in rubric_lookup.values():
                            if ind_name in rubric_cat["indicators"]:
                                indicator_id = rubric_cat["indicators"][ind_name]["indicator_id"]
                                break

                        print(f"[AUDIT DEBUG] ind_name={ind_name} | ind_data={ind_data} | ai_score={ai_score} | ai_max={ai_max}", flush=True)

                        cursor.execute(
                            """INSERT OR REPLACE INTO ai_audit_results
                               (meeting_id, session_id, category_id, indicator_id,
                                ai_score, ai_max_score, ai_raw_response, oqi_score,
                                evidence_quote, talk_ratio)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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

                    cursor.execute(
                        """INSERT OR REPLACE INTO ai_audit_results
                           (meeting_id, session_id, category_id, indicator_id,
                            ai_score, ai_max_score, ai_raw_response, oqi_score,
                            evidence_quote, talk_ratio)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            meeting_id, session_id,
                            category_id, cat_name,
                            score, 2, raw_response, oqi_score,
                            evidence_quote, talk_ratio_json
                        )
                    )
                    indicator_count += 1

            conn.commit()
            print(f"[AUDIT MICROSERVICE] Status: Successfully stored {indicator_count} indicator results in ai_audit_results table.", flush=True)

        except Exception as e:
            print(f"[AUDIT MICROSERVICE] ERROR: Failed to store audit results in database: {str(e)}", flush=True)
            traceback.print_exc()
        finally:
            if conn:
                conn.close()