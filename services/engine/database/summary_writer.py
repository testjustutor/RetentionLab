# root/services/engine/database/summary_writer.py

import sqlite3


class SummaryWriter:

    """
    Stores generated summaries.
    """

    @staticmethod
    def save(
        db_path,
        meeting_id,
        summary_path
    ):

        connection = sqlite3.connect(
            db_path
        )

        cursor = connection.cursor()

        cursor.execute(

            """
            INSERT INTO summaries
            (
                meeting_id,
                summary_path
            )
            VALUES (?, ?)
            """,

            (
                meeting_id,
                summary_path
            )
        )

        connection.commit()

        connection.close()