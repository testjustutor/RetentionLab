# services/engine/transcription_service/segment_merger.py

class SegmentMerger:

    """
    Merges tiny transcript segments.
    """

    @staticmethod
    def merge(
        segments,
        min_words=3
    ):

        merged = []

        buffer = None

        for segment in segments:

            text = segment.get(
                "text",
                ""
            )

            word_count = len(
                text.split()
            )

            if word_count < min_words:

                if buffer is None:

                    buffer = segment

                else:

                    buffer["text"] += (
                        " " + text
                    )

                    buffer["end"] = (
                        segment["end"]
                    )

            else:

                if buffer:

                    merged.append(
                        buffer
                    )

                    buffer = None

                merged.append(
                    segment
                )

        if buffer:

            merged.append(
                buffer
            )

        return merged