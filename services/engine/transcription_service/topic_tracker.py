class TopicTracker:

    """
    Tracks topic frequency.
    """

    @staticmethod
    def analyze(
        transcript
    ):

        keywords = [

            "deadline",
            "client",
            "budget",
            "meeting",
            "deployment"
        ]

        findings = {}

        lower = transcript.lower()

        for keyword in keywords:

            findings[keyword] = (
                lower.count(keyword)
            )

        return findings