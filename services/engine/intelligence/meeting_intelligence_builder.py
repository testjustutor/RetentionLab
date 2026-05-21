class MeetingIntelligenceBuilder:

    """
    Aggregates intelligence payload.
    """

    @staticmethod
    def build(
        transcript,
        sentiment,
        topics
    ):

        return {

            "transcript": transcript,

            "sentiment": sentiment,

            "topics": topics
        }