# root/services/engine/ai_audit_service/rubric_loader.py

from database.python_db import get_cursor

class RubricLoader:
    def load_rubric(self):
        with get_cursor() as cursor:
            cursor.execute("""
                SELECT category_id,
                       name,
                       weight
                FROM rubric_categories
                ORDER BY category_id
            """)
            categories = cursor.fetchall()

            cursor.execute("""
                SELECT indicator_id,
                       category_id,
                       name,
                       type,
                       value,
                       is_gate
                FROM rubric_indicators
                ORDER BY category_id
            """)
            indicators = cursor.fetchall()

        return {
            "categories": categories,
            "indicators": indicators
        }
