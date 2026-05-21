import os


class ChromeProfileManager:

    """
    Chrome profile utilities.
    """

    @staticmethod
    def ensure(
        profile_dir
    ):

        os.makedirs(
            profile_dir,
            exist_ok=True
        )

        return profile_dir