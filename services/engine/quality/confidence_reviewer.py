# root/services/engine/quality/confidence_reviewer.py

class ConfidenceReviewer:

    """
    Confidence score review.
    """

    @staticmethod
    def review(
        confidence
    ):

        if confidence >= 90:

            return "excellent"

        if confidence >= 75:

            return "good"

        if confidence >= 60:

            return "average"

        return "poor"