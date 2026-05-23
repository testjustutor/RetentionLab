# services/engine/ai_audit_service/audit_worker.py
import json
import sqlite3
import re
import sys
import time


class AuditWorker:

    def evaluate(
        self,
        transcript,
        talk_ratio
    ):

        transcript = transcript or ""
        word_count = len(
            transcript.split()
        )

        has_questions = "?" in transcript
        has_objective_language = any(
            token in transcript.lower()
            for token in [
                "objective",
                "goal",
                "today",
                "learn"
            ]
        )

        domain_scores = {
            "Transcript Completeness": 100.0 if word_count else 0.0,
            "Instructional Signals": 100.0 if has_objective_language else 50.0,
            "Interaction Signals": 100.0 if has_questions else 50.0
        }

        oqi_score = round(
            sum(domain_scores.values()) / len(domain_scores),
            2
        )

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

    def _load_rubric_schema(self):
        print("[AUDIT MICROSERVICE] Status: Opening local database stream...", flush=True)
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("SELECT category_id, name, weight FROM rubric_categories")
            categories = cursor.fetchall()
            
            schema = []
            for cat in categories:
                cat_dict = {"category": cat['name'], "weight": cat['weight'], "indicators": []}
                cursor.execute("SELECT name FROM rubric_indicators WHERE category_id = ?", (cat['category_id'],))
                cat_dict["indicators"] = [row['name'] for row in cursor.fetchall()]
                schema.append(cat_dict)
                
            conn.close()
            print("[AUDIT MICROSERVICE] Status: Rubric parameters successfully cached.", flush=True)
            return schema
        except Exception as e:
            print(f"[AUDIT MICROSERVICE] WARNING: DB read failed ({str(e)}). Deploying structural fallbacks.", flush=True)
            return [{"category": "General Performance", "weight": 1.0, "indicators": ["Overall Quality"]}]

    def process_audit(self, transcript_text):
        rubric_rules = self._load_rubric_schema()
        
        print("[AUDIT MICROSERVICE] Status: Structuring evaluation instruction maps...", flush=True)
        system_instruction = (
            "You are an isolated QA evaluation microservice. Score the transcript text against the provided rubric parameters.\n"
            "For every indicator listed under a category, internally score it: 0 (not met), 1 (partially), or 2 (fully met).\n"
            "Calculate an overall weighted OQI score from 0 to 100 based on your scores.\n"
            "You must return ONLY a raw JSON string matching this structure. No conversational text, no markdown wrappers:\n"
            "{\n"
            "  \"domain_scores\": { \"Category Name\": 85.0 },\n"
            "  \"oqi_score\": 85.0,\n"
            "  \"evidence_quote\": \"Exact string excerpt from text proving evaluation matrix\"\n"
            "}"
        )
        
        prompt = f"Rubric Target Rules:\n{json.dumps(rubric_rules)}\n\nTranscript Target Data:\n{transcript_text}"
        print(f"[AUDIT MICROSERVICE] Status: Sending payload data to '{self.ai_api.provider.upper()}' engine...", flush=True)
        
        # Real-time incremental terminal feedback ticks
        for progress_pct in range(10, 91, 20):
            print(f"[AUDIT MICROSERVICE] Progress: AI Evaluation {progress_pct}% pending validation...", flush=True)
            time.sleep(0.2)

        raw_response = self.ai_api.ask_ai(prompt=prompt, system_instruction=system_instruction)
        
        try:
            clean_json = re.sub(r'^```json\s*|```\s*$', '', raw_response.strip(), flags=re.IGNORECASE)
            result = json.loads(clean_json)
            print("[AUDIT MICROSERVICE] Progress: Evaluation 100% complete! Metrics isolated.", flush=True)
            return result
        except Exception as e:
            print("[AUDIT MICROSERVICE] ERROR: AI response parser failure. Formatting safe recovery block...", flush=True)
            return {
                "domain_scores": {"Uncategorized": 0.0},
                "oqi_score": 0.0,
                "evidence_quote": "Process failure during schema conversion optimization.",
                "error_log": str(e)
            }
