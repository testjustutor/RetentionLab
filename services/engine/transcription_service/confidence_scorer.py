class ConfidenceScorer:

    """
    Calculates transcript confidence.
    """

    @staticmethod
    def calculate(
        segments
    ):

        if not segments:

            return 0

        total = 0

        count = 0

        for segment in segments:

            avg = segment.get(
                "avg_logprob",
                -1
            )

            confidence = max(
                0,
                min(
                    1,
                    avg + 1
                )
            )

            total += confidence

            count += 1

        return round(
            (total / count) * 100,
            2
        )