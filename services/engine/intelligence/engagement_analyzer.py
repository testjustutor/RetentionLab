class EngagementAnalyzer:

    """
    Calculates engagement levels.
    """

    @staticmethod
    def analyze(
        talk_ratio
    ):

        if not talk_ratio:

            return "unknown"

        highest = max(
            talk_ratio.values()
        )

        if highest > 80:

            return "dominated"

        if highest > 60:

            return "imbalanced"

        return "balanced"