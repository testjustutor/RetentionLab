# root/services/engine/quality/transcript_validator.py

class TranscriptValidator:

    """
    Transcript quality checks.
    """

    @staticmethod
    def validate(
        transcript
    ):

        if not transcript:

            return False

        words = transcript.split()

        if len(words) < 5:

            return False

        return True