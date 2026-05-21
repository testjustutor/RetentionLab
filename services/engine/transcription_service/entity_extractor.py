import re


class EntityExtractor:

    """
    Simple entity extraction.
    """

    EMAIL_PATTERN = (
        r"[a-zA-Z0-9_.+-]+@"
        r"[a-zA-Z0-9-]+\."
        r"[a-zA-Z0-9-.]+"
    )

    @classmethod
    def extract(
        cls,
        transcript
    ):

        emails = re.findall(

            cls.EMAIL_PATTERN,

            transcript
        )

        return {

            "emails": emails
        }