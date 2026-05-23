import os
import time


class CacheIndexer:

    """
    Indexes cache files.
    """

    @staticmethod
    def index(
        directory
    ):

        indexed = []

        if not os.path.exists(
            directory
        ):

            return indexed

        for file_name in os.listdir(
            directory
        ):

            path = os.path.join(
                directory,
                file_name
            )

            if not os.path.isfile(path):

                continue

            indexed.append({

                "file": file_name,

                "path": path,

                "size_mb": round(

                    os.path.getsize(path)
                    / (1024 * 1024),

                    2
                ),

                "modified": time.ctime(

                    os.path.getmtime(path)
                )
            })

        return indexed