"""
services/engine/rubric_loader.py

DATA-ACCESS ONLY. Loads the rubric schema (categories + indicators) from the
database. No business logic - just queries that hand back a clean structure.

Every per-indicator behavior flag (requires_video, requires_calculation +
its calculation_config) is read straight off the row here and handed
downstream as data. Nothing in this module - or in audit_service.py, which
consumes it - ever branches on an indicator_code/name/id: whether an
indicator goes to the AI, gets computed, or gets excluded is entirely a
function of these DB columns, so a rubric config change never requires a
Python code change.
"""
import json

from database.python_db import get_cursor


def _parse_calculation_config(raw):
    """Best-effort JSON parse of the calculation_config column. Returns a
    dict on success, or None when the column is empty/NULL or holds
    malformed JSON (treated as "no usable config" rather than a crash -
    the indicator simply won't be computable, same as a missing metric)."""
    if not raw:
        return None
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return parsed if isinstance(parsed, dict) else None


class RubricLoader:
    """Load rubric categories + indicators from the DB."""

    def load_rubric(self) -> dict:
        with get_cursor() as cursor:
            cursor.execute(
                """
                SELECT id, category_code, name, weight
                FROM rubric_categories
                ORDER BY id
                """
            )
            categories = cursor.fetchall()

            cursor.execute(
                """
                SELECT ri.id,
                       ri.indicator_code,
                       ri.category_id,
                       rc.category_code AS category_code,
                       ri.subgroup_name,
                       ri.name,
                       ri.type,
                       ri.value,
                       ri.is_gate,
                       ri.benchmark,
                       ri.requires_video,
                       ri.requires_calculation,
                       ri.calculation_config
                FROM rubric_indicators ri
                JOIN rubric_categories rc ON rc.id = ri.category_id
                ORDER BY ri.category_id, ri.indicator_code
                """
            )
            indicators = cursor.fetchall()

        return {
            "categories": [
                {
                    "id": cat.get("id"),
                    "category_code": cat.get("category_code"),
                    "name": cat.get("name"),
                    "weight": cat.get("weight"),
                }
                for cat in categories
            ],
            "indicators": [
                {
                    "id": ind.get("id"),
                    "indicator_code": ind.get("indicator_code"),
                    "category_id": ind.get("category_id"),
                    "category_code": ind.get("category_code"),
                    "name": ind.get("name"),
                    "subgroup_name": ind.get("subgroup_name"),
                    "type": ind.get("type") or "AI",
                    "value": ind.get("value") or 1,
                    "is_gate": bool(ind.get("is_gate")),
                    "benchmark": ind.get("benchmark"),
                    "requires_video": bool(ind.get("requires_video")),
                    "requires_calculation": bool(ind.get("requires_calculation")),
                    "calculation_config": _parse_calculation_config(ind.get("calculation_config")),
                }
                for ind in indicators
            ],
        }