class TranscriptCleaner:

    """
    Cleans transcript artifacts.
    """

    @staticmethod
    def clean(
        transcript
    ):

        replacements = {

            " uh ": " ",

            " um ": " ",

            " you know ": " "
        }

        cleaned = (
            " " + transcript + " "
        )

        for old, new in (
            replacements.items()
        ):

            cleaned = cleaned.replace(
                old,
                new
            )

        return cleaned.strip()