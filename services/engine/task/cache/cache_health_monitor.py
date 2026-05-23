import os


class CacheHealthMonitor:

    """
    Cache health diagnostics.
    """

    @staticmethod
    def analyze(context):

        report = {}

        for key, path in context.storage_paths.items():

            try:

                total_files = len(
                    os.listdir(path)
                )

                report[key] = {

                    "path": path,

                    "files": total_files,

                    "exists": True
                }

            except Exception:

                report[key] = {

                    "path": path,

                    "exists": False
                }

        return report