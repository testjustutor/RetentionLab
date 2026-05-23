import os
import time


class CacheExpirationManager:

    """
    Removes expired cache files.
    """

    @staticmethod
    def cleanup(
        directory,
        expiration_hours=72
    ):

        if not os.path.exists(
            directory
        ):

            return

        now = time.time()

        expiration_seconds = (
            expiration_hours * 3600
        )

        for file_name in os.listdir(
            directory
        ):

            path = os.path.join(
                directory,
                file_name
            )

            if not os.path.isfile(path):

                continue

            modified = os.path.getmtime(
                path
            )

            age = now - modified

            if age > expiration_seconds:

                try:

                    os.remove(path)

                except Exception:

                    continue