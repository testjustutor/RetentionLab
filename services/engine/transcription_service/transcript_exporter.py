# services/engine/transcription_service/transcript_exporter.py

import json
import os


class TranscriptExporter:

    """
    Exports transcript formats.
    """

    @staticmethod
    def export_json(
        output_path,
        payload
    ):

        os.makedirs(

            os.path.dirname(output_path),

            exist_ok=True
        )

        with open(

            output_path,

            "w",

            encoding="utf-8"
        ) as file:

            json.dump(

                payload,

                file,

                indent=4
            )

    # ==========================================
    # EXPORT TXT
    # ==========================================

    @staticmethod
    def export_text(
        output_path,
        transcript
    ):

        with open(

            output_path,

            "w",

            encoding="utf-8"
        ) as file:

            file.write(
                transcript
            )