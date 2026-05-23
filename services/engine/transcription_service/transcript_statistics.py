class TranscriptStatistics:

    """
    Transcript analytics.
    """

    @staticmethod
    def generate(
        transcript
    ):

        words = transcript.split()

        return {

            "word_count": len(words),

            "character_count": len(
                transcript
            ),

            "line_count": len(

                transcript.splitlines()
            )
        }