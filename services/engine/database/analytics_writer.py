# root/services/engine/database/analytics_writer.py

import sqlite3
import json


class AnalyticsWriter:

    """
    Stores analytics payloads.
    """

    @staticmethod
    def save(
        db_path,
        meeting_id,
        analytics
    ):

        connection = sqlite3.connect(
            db_path
        )

        cursor = connection.cursor()

        cursor.execute(

            """
            INSERT INTO analytics
            (
                meeting_id,
                payload
            )
            VALUES (?, ?)
            """,

            (
                meeting_id,
                json.dumps(analytics)
            )
        )

        connection.commit()

        connection.close()