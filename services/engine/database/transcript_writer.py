import sqlite3


class TranscriptWriter:

    """
    Stores transcript metadata.
    """

    @staticmethod
    def save(
        db_path,
        meeting_id,
        transcript_path
    ):

        connection = sqlite3.connect(
            db_path
        )

        cursor = connection.cursor()

        cursor.execute(

            """
            INSERT INTO transcripts
            (
                meeting_id,
                transcript_path
            )
            VALUES (?, ?)
            """,

            (
                meeting_id,
                transcript_path
            )
        )

        connection.commit()

        connection.close()