# services/engine/transcription_service/meeting_classifier.py

class MeetingClassifier:

    """
    Predicts meeting category.
    """

    @staticmethod
    def classify(
        transcript
    ):

        lower = transcript.lower()

        if "interview" in lower:

            return "interview"

        if "sprint" in lower:

            return "engineering"

        if "sales" in lower:

            return "sales"

        return "general"