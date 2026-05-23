class SpeakerOverlapDetector:

    """
    Detects overlapping speakers.
    """

    @staticmethod
    def detect(
        diarization
    ):

        overlaps = []

        for i in range(
            len(diarization) - 1
        ):

            current = diarization[i]

            nxt = diarization[i + 1]

            if current["end"] > nxt["start"]:

                overlaps.append({

                    "a": current,

                    "b": nxt
                })

        return overlaps