# services/engine/services/rubric_loader.py

from database.python_db import get_cursor

class RubricLoader:
    def load_rubric(self):
        with get_cursor() as cursor:
            cursor.execute("""
                SELECT id,
                       category_code,
                       name,
                       weight
                FROM rubric_categories
                ORDER BY id
            """)
            categories = cursor.fetchall()

            cursor.execute("""
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
            """)
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
            # Normalize each indicator so the AI payload receives clean boolean
            # flags (requires_video / is_gate) rather than raw 0/1 ints — the audit
            # system instruction tells the AI to test "requires_video" as a flag.
            # category_id is the numeric FK to rubric_categories.id.
            "indicators": [
                {
                    "id": ind.get("id"),
                    "indicator_code": ind.get("indicator_code"),
                    "category_id": ind.get("category_id"),     # numeric FK
                    "category_code": ind.get("category_code"), # resolved category code
                    "name": ind.get("name"),
                    "subgroup_name": ind.get("subgroup_name"),
                    "type": ind.get("type") or "AI",
                    "value": ind.get("value") or 1,
                    "is_gate": bool(ind.get("is_gate")),
                    "benchmark": ind.get("benchmark"),
                    "requires_video": bool(ind.get("requires_video"))
                }
                for ind in indicators
            ]
        }
