class SentimentAnalyzer:

    """
    Lightweight sentiment analyzer.
    """

    POSITIVE = [

        "great",
        "excellent",
        "good",
        "success"
    ]

    NEGATIVE = [

        "issue",
        "problem",
        "delay",
        "risk"
    ]

    @classmethod
    def analyze(
        cls,
        transcript
    ):

        lower = transcript.lower()

        positive = sum(

            lower.count(word)

            for word in cls.POSITIVE
        )

        negative = sum(

            lower.count(word)

            for word in cls.NEGATIVE
        )

        return {

            "positive": positive,

            "negative": negative
        }