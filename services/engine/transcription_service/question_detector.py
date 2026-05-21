class QuestionDetector:

    """
    Detects transcript questions.
    """

    @staticmethod
    def detect(
        transcript
    ):

        questions = []

        for line in (
            transcript.splitlines()
        ):

            if "?" in line:

                questions.append(
                    line
                )

        return questions