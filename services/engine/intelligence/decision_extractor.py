# services/engine/intelligence/decision_extractor.py

class DecisionExtractor:

    """
    Extracts possible decisions.
    """

    KEYWORDS = [

        "approved",
        "decided",
        "confirmed",
        "finalized"
    ]

    @classmethod
    def extract(
        cls,
        transcript
    ):

        findings = []

        for line in (
            transcript.splitlines()
        ):

            lower = line.lower()

            for keyword in cls.KEYWORDS:

                if keyword in lower:

                    findings.append(
                        line
                    )

                    break

        return findings