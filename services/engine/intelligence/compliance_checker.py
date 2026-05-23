class ComplianceChecker:

    """
    Detects compliance-sensitive phrases.
    """

    TERMS = [

        "confidential",
        "nda",
        "restricted",
        "internal only"
    ]

    @classmethod
    def check(
        cls,
        transcript
    ):

        findings = []

        lower = transcript.lower()

        for term in cls.TERMS:

            if term in lower:

                findings.append(term)

        return findings