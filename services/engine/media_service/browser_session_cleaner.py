import shutil
import os


class BrowserSessionCleaner:

    """
    Cleans temporary sessions.
    """

    @staticmethod
    def cleanup(
        directory
    ):

        if not os.path.exists(
            directory
        ):

            return

        shutil.rmtree(
            directory,
            ignore_errors=True
        )