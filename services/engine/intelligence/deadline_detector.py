# services/engine/intelligence/deadline_detector.py

import re


class DeadlineDetector:

    """
    Detects deadline references.
    """

    DATE_PATTERN = (
        r"\b\d{1,2}/\d{1,2}/\d{2,4}\b"
    )

    @classmethod
    def detect(
        cls,
        transcript
    ):

        return re.findall(

            cls.DATE_PATTERN,

            transcript
        )