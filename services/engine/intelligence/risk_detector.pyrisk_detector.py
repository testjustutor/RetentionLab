class RiskDetector:

    """
    Detects meeting risks.
    """

    RISK_WORDS = [

        "delay",
        "issue",
        "blocker",
        "risk",
        "problem"
    ]

    @classmethod
    def detect(
        cls,
        transcript
    ):

        lower = transcript.lower()

        findings = []

        for word in cls.RISK_WORDS:

            if word in lower:

                findings.append(word)

        return findings