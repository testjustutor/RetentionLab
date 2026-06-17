# root/services/engine/cache/cache_integrity_checker.py

import os


class CacheIntegrityChecker:

    """
    Detects corrupted cache files.
    """

    @staticmethod
    def validate(
        directory
    ):

        invalid = []

        if not os.path.exists(
            directory
        ):

            return invalid

        for file_name in os.listdir(
            directory
        ):

            path = os.path.join(
                directory,
                file_name
            )

            if not os.path.isfile(path):

                continue

            try:

                size = os.path.getsize(
                    path
                )

                if size <= 0:

                    invalid.append(path)

            except Exception:

                invalid.append(path)

        return invalid