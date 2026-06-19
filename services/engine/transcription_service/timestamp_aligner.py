# services/engine/transcription_service/timestamp_aligner.py

class TimestampAligner:

    """
    Timestamp alignment utility.
    """

    @staticmethod
    def align(
        segments
    ):

        aligned = []

        for segment in segments:

            segment["start"] = round(

                segment.get(
                    "start",
                    0
                ),

                2
            )

            segment["end"] = round(

                segment.get(
                    "end",
                    0
                ),

                2
            )

            aligned.append(
                segment
            )

        return aligned