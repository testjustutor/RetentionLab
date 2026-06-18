# services/engine/intelligence/interruption_detector.py

class InterruptionDetector:

    """
    Detects interruptions.
    """

    @staticmethod
    def detect(
        diarization
    ):

        interruptions = []

        for i in range(
            len(diarization) - 1
        ):

            current = diarization[i]

            nxt = diarization[i + 1]

            if current["end"] > nxt["start"]:

                interruptions.append({

                    "from": current["speaker"],

                    "to": nxt["speaker"]
                })

        return interruptions