"""
services/engine/audit_service.py

AI audit orchestrator for the consolidated python_engine.

Flow (same as the legacy audit implemented self-contained here):
    1. Load rubric (categories + indicators) from DB.
    2. Build a nested schema (for scoring + storage) and a compact prompt
       (code|gate|benchmark lines + transcript) for the LLM.
    3. Call the AI client, parse the compact JSON response, expand it into a
       per-category structure, and recompute category + weighted OQI scores in
       code (never trusting the LLM's math). Status codes: 1=Met, 2=Not Met,
       3=Not Applicable. See audit_scoring.py for the shared math.
    4. Persist per-indicator rows to `ai_audit_results`, summary to
       `session_rubric_summary`, and save the exact request/response to a prompt
       file for replay.

THIS IS THE ONLY CANONICAL AUDIT ENGINE. services/engine/services/audit_worker.py
and services/engine/services/ai_audit.py are legacy/unused duplicates — do not
wire new callers to them.
"""
import json
import os
import re
import time
from decimal import Decimal
from typing import Any, Dict, List, Optional

from utils.logger_util import log_with_type

from .rubric_loader import RubricLoader
from .audit_storage import AuditStorage, _derive_rating, _json_default
from .audit_scoring import (
    compute_category_score,
    compute_weighted_overall,
    STATUS_MET,
    STATUS_NOT_MET,
    STATUS_NOT_APPLICABLE,
)


def _normalize_jsonable(value):
    """Recursively convert non-JSON types (Decimal, etc.) to plain JSON-safe
    values so result dicts can always be json.dumps'd."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: _normalize_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_normalize_jsonable(v) for v in value]
    return value

# fmt: off
_AUDIT_SYSTEM_INSTRUCTION = (
    "Evaluate the tutoring transcript against the supplied indicators. "
    "Output ONLY JSON:\n"
    '{"scores":{"A1.1":{"s":1,"e":"quote"},"A1.2":{"s":0,"r":"reason","e":"quote"},'
    '"A1.4":{"s":null,"r":"partial session"}},"gate_failures":[],"evidence_quote":"best quote"}\n'
    "Rules: 1=Met, 0=Not Met, null=Not applicable/insufficient evidence. "
    "Score 0 for observed failures. Gates with s=0 go in gate_failures; "
    "null never counts. ASR errors -> treat as intended word, dont penalize. "
    "Cite <=12-word evidence; for 0/null add a <=15-word reason."
)
# fmt: on

_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_DIR, "..", ".."))
OUTPUT_DIR = os.path.join(_PROJECT_ROOT, "storage", "cache_llm_prompts")

def default_prompt_path(meeting_id, session_id):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    return os.path.join(OUTPUT_DIR, f"PROMPT_AUDIT_{meeting_id}_{session_id}.json")


class AuditService:
    def __init__(self, ai_client=None):
        if ai_client is None:
            from .ai_client import AiClient
            ai_client = AiClient()
        self.ai_client = ai_client
        self.loader = RubricLoader()

    # ------------------------------------------------------------------
    # Schema building
    # ------------------------------------------------------------------
    def _load_nested_schema(self) -> List[Dict[str, Any]]:
        raw = self.loader.load_rubric()
        ind_by_cat: Dict[int, list] = {}
        for ind in raw["indicators"]:
            ind_by_cat.setdefault(ind["category_id"], []).append(ind)
        return [
            {
                "category": cat["name"],
                "weight": cat["weight"],
                "category_id": cat["category_code"],
                "category_id_pk": cat["id"],
                "indicators": [
                    {
                        "indicator_id": ind["indicator_code"],
                        "indicator_id_pk": ind["id"],
                        "subgroup_name": ind.get("subgroup_name"),
                        "name": ind["name"],
                        "type": ind["type"] or "AI",
                        "is_gate": ind["is_gate"],
                        "value": ind.get("value") or 1,
                        "benchmark": ind.get("benchmark"),
                        "requires_video": ind["requires_video"],
                    }
                    for ind in ind_by_cat.get(cat["id"], [])
                ],
            }
            for cat in raw["categories"]
        ]

    @staticmethod
    def _build_compact_prompt(rubric_schema, transcript_text):
        ind_lines = ["INDICATORS (code|gate|benchmark):"]
        for cat in rubric_schema:
            for ind in cat.get("indicators", []):
                if ind.get("requires_video"):
                    continue
                code = ind.get("indicator_id")
                gate = "G" if ind.get("is_gate") else "."
                benchmark = (ind.get("benchmark") or "").strip()
                ind_lines.append(f"{code}|{gate}|{benchmark}")
        return "\n".join(ind_lines) + "\n\nTranscript:\n" + (transcript_text or "")

    # ------------------------------------------------------------------
    # Compact LLM response -> full per-category structure (STATUS CODES:
    # 1=Met, 2=Not Met, 3=Not Applicable). All math goes through
    # audit_scoring.py so every audit path in the codebase computes
    # identically.
    # ------------------------------------------------------------------
    @staticmethod
    def _expand_compact_result(rubric_schema, compact):
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
        category_pct_weight_pairs = []

        for cat in rubric_schema:
            cat_name = cat.get("category")
            weight = float(cat.get("weight") or 0)
            indicators_out = {}
            statuses = []

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
                    # Coerce any abnormal s to binary 0/1
                    score = 1 if score >= 1 else 0
                    status = STATUS_MET if score == 1 else STATUS_NOT_MET
                    if is_gate and score == 0:
                        gate_set.add(code)
                else:
                    status = STATUS_NOT_APPLICABLE
                    if requires_video:
                        reason = reason or "requires video"
                        evidence = "requires video"
                    elif not reason:
                        reason = "not observable from the provided transcript"

                statuses.append(status)

                rating = (
                    "Met" if status == STATUS_MET
                    else "Not met" if status == STATUS_NOT_MET
                    else "N/A"
                )
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
                    "status_code": status,
                }

            cat_pct = compute_category_score(statuses)
            met_count = sum(1 for s in statuses if s == STATUS_MET)
            not_met_count = sum(1 for s in statuses if s == STATUS_NOT_MET)
            na_count = sum(1 for s in statuses if s == STATUS_NOT_APPLICABLE)

            category_scores[cat_name] = {
                "score": cat_pct,
                "scored": met_count + not_met_count,
                "excluded": na_count,
                "scored_indicator_count": met_count + not_met_count,
                "excluded_indicator_count": na_count,
                "indicators": indicators_out,
            }
            category_pct_weight_pairs.append((cat_pct, weight))

        oqi_score = compute_weighted_overall(category_pct_weight_pairs)
        return {
            "category_scores": category_scores,
            "oqi_score": oqi_score,
            "gate_failures": sorted(gate_set),
            "evidence_quote": evidence_quote,
        }

    # ------------------------------------------------------------------
    # Main entry
    # ------------------------------------------------------------------
    def process_audit(self, transcript_text, meeting_id=None, session_id=None, talk_ratio=None, prompt_output_path=None):
        log_with_type("info", f"audit/service: starting audit meeting={meeting_id} session={session_id}", "PYTHON_ENGINE")
        rubric_schema = self._load_nested_schema()
        log_with_type("info", f"audit/service: rubric schema loaded ({len(rubric_schema)} categories)", "PYTHON_ENGINE")

        system_instruction = _AUDIT_SYSTEM_INSTRUCTION
        prompt = self._build_compact_prompt(rubric_schema, transcript_text)
        # Prefer the shared, base_id-named path passed in by audit_task.py
        # (storage/cache_llm_prompts/PROMPT_<base_id>.json - the SAME file
        # tutor_eval_task.py writes its section into) so both AI evaluations
        # for a session land in one file. Falls back to the legacy
        # meeting/session-id-named path only when no caller supplies one.
        prompt_path = prompt_output_path or default_prompt_path(meeting_id, session_id)

        AuditStorage.save_prompt_file(
            prompt_path, meeting_id, session_id, system_instruction, prompt,
            self.ai_client, raw_response=None, status="PENDING",
        )

        raw_response = self.ai_client.ask_ai(prompt=prompt, system_instruction=system_instruction)
        AuditStorage.save_prompt_file(
            prompt_path, meeting_id, session_id, system_instruction, prompt,
            self.ai_client, raw_response=raw_response, status="OK",
        )
        log_with_type("info", f"audit/service: AI call returned {len(raw_response or '')} chars", "PYTHON_ENGINE")

        try:
            clean_json = re.sub(r'^```(?:json)?\s*|```\s*$', '', raw_response.strip(), flags=re.IGNORECASE).strip()
            try:
                result = json.loads(clean_json)
            except Exception:
                start = clean_json.find("{")
                end = clean_json.rfind("}")
                if start != -1 and end != -1 and end > start:
                    result = json.loads(clean_json[start:end + 1])
                else:
                    raise
        except Exception as e:
            log_with_type("error", f"audit/service: JSON parse failed -> {e}", "PYTHON_ENGINE")
            result = {
                "category_scores": {
                    "Uncategorized": {
                        "score": 0.0,
                        "indicators": {"Unknown": {"score": 0, "max_score": 0, "evidence": "Parse failure"}},
                    }
                },
                "oqi_score": 0.0,
                "evidence_quote": "Process failure during schema conversion optimization.",
                "error_log": str(e),
            }

        if isinstance(result, dict) and isinstance(result.get("scores"), dict):
            result = self._expand_compact_result(rubric_schema, result)

        result["rubric_schema"] = rubric_schema

        if meeting_id:
            AuditStorage.store_audit_results(meeting_id, session_id, rubric_schema, result)
            AuditStorage.store_summary(meeting_id, session_id, result)
        else:
            log_with_type("warning", "audit/service: meeting_id not provided - skipping DB storage", "PYTHON_ENGINE")

        log_with_type("info", f"audit/service: audit complete oqi={result.get('oqi_score')} gates={result.get('gate_failures')}", "PYTHON_ENGINE")

        result = _normalize_jsonable(result)
        result["talk_ratio"] = talk_ratio or {}
        return result

    def run_audit(self, transcript_text, meeting_id=None, session_id=None, talk_ratio=None, prompt_output_path=None):
        return self.process_audit(
            transcript_text,
            meeting_id=meeting_id,
            session_id=session_id,
            talk_ratio=talk_ratio,
            prompt_output_path=prompt_output_path,
        )