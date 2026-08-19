# services/engine/transcription_service/action_item_detector.py

class ActionItemDetector:

    """
    Detects possible action items.
    """

    KEYWORDS = [

        "todo",
        "action item",
        "follow up",
        "deadline",
        "assign"
    ]

    @classmethod
    def detect(
        cls,
        transcript
    ):

        findings = []

        lines = transcript.splitlines()

        for line in lines:

            lower = line.lower()

            for keyword in cls.KEYWORDS:

                if keyword in lower:

                    findings.append(
                        line
                    )

                    break

        return findings