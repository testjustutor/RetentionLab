class SpeakerMapper:

    """
    Maps diarization speakers.
    """

    @staticmethod
    def map_segments(
        segments,
        diarization
    ):

        mapped = []

        for segment in segments:

            segment["speaker"] = (
                "Speaker 1"
            )

            mapped.append(
                segment
            )

        return mapped