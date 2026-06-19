# services/engine/transcription_service/language_detector.py

class LanguageDetector:

    """
    Detects transcript language.
    """

    @staticmethod
    def detect(
        whisper_result
    ):

        return whisper_result.get(
            "language",
            "unknown"
        )