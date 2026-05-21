import os


class CacheMetrics:

    """
    Cache analytics utility.
    """

    @staticmethod
    def collect(context):

        metrics = {}

        for key, path in (
            context.storage_paths.items()
        ):

            if not os.path.exists(path):

                metrics[key] = {

                    "exists": False
                }

                continue

            total_size = 0

            total_files = 0

            for root, _, files in os.walk(
                path
            ):

                for file in files:

                    file_path = os.path.join(
                        root,
                        file
                    )

                    try:

                        total_size += (
                            os.path.getsize(
                                file_path
                            )
                        )

                        total_files += 1

                    except Exception:

                        continue

            metrics[key] = {

                "exists": True,

                "total_files": total_files,

                "total_size_mb": round(
                    total_size / (
                        1024 * 1024
                    ),
                    2
                )
            }

        return metrics