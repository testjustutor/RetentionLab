# root/services/engine/cache/cache_size_controller.py

import os


class CacheSizeController:

    """
    Calculates cache sizes.
    """

    @staticmethod
    def calculate(
        directory
    ):

        total = 0

        if not os.path.exists(
            directory
        ):

            return 0

        for root, _, files in os.walk(
            directory
        ):

            for file in files:

                path = os.path.join(
                    root,
                    file
                )

                try:

                    total += os.path.getsize(
                        path
                    )

                except Exception:

                    continue

        return round(

            total / (
                1024 * 1024
            ),

            2
        )