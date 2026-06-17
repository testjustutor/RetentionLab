# root/services/engine/ai_audit_service/rubric_loader.py

from services.shared.database.connection_manager import get_connection_manager

class RubricLoader:
    def __init__(self):
        self.manager = get_connection_manager()

    def load_rubric(self):
        with self.manager.get_cursor() as cursor:
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
            "categories": [dict(r) for r in categories],
            "indicators": [dict(r) for r in indicators]
        }