"""
services/engine/python_engine/audit/rubric_loader.py

DATA-ACCESS ONLY. Loads the rubric schema (categories + indicators) from the
database. No business logic - just queries that hand back a clean structure.
"""
from database.python_db import get_cursor


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
                       ri.requires_video
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
                }
                for ind in indicators
            ],
        }