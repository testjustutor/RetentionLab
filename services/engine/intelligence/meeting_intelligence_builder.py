# services/engine/intelligence/meeting_intelligence_builder.py

class MeetingIntelligenceBuilder:

    """
    Aggregates intelligence payload.
    """

    @staticmethod
    def build(
        transcript,
        sentiment
    ):

        return {

            "transcript": transcript,

            "sentiment": sentiment
        }