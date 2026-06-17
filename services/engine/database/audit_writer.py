# root/services/engine/database/audit_writer.py

import sqlite3
import json


class AuditWriter:

    """
    Stores audit results.
    """

    @staticmethod
    def save(
        db_path,
        meeting_id,
        audit_data
    ):

        connection = sqlite3.connect(
            db_path
        )

        cursor = connection.cursor()

        cursor.execute(

            """
            INSERT INTO audits
            (
                meeting_id,
                payload
            )
            VALUES (?, ?)
            """,

            (
                meeting_id,
                json.dumps(audit_data)
            )
        )

        connection.commit()

        connection.close()