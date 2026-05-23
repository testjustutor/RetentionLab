class TranscriptRepairEngine:

    """
    Repairs transcript formatting issues.
    """

    @staticmethod
    def repair(
        transcript
    ):

        transcript = transcript.replace(
            "  ",
            " "
        )

        transcript = transcript.replace(
            "\n\n",
            "\n"
        )

        return transcript.strip()