class HallucinationDetector:

    """
    Detects suspicious transcript output.
    """

    BLOCKED_PATTERNS = [

        "thank you for watching",

        "subscribe to the channel",

        "music"
    ]

    @classmethod
    def detect(
        cls,
        transcript
    ):

        transcript_lower = (
            transcript.lower()
        )

        findings = []

        for pattern in cls.BLOCKED_PATTERNS:

            if pattern in transcript_lower:

                findings.append(
                    pattern
                )

        return findings