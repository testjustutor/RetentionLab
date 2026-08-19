import os
import time


def run_cache_rotation_task(context):

    """
    Rotates oversized cache folders.
    """

    max_cache_size_mb = 2048

    monitored = [

        "cache_whisper",

        "cache_audio_transcripts"
    ]

    for key in monitored:

        directory = context.storage_paths.get(
            key
        )

        if not directory:

            continue

        total_size = 0

        files = []

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

                modified = os.path.getmtime(
                    path
                )

                total_size += size

                files.append({

                    "path": path,

                    "size": size,

                    "modified": modified
                })

            except Exception:

                continue

        total_size_mb = (
            total_size / (
                1024 * 1024
            )
        )

        if total_size_mb <= max_cache_size_mb:

            continue

        files.sort(
            key=lambda x: x["modified"]
        )

        while total_size_mb > max_cache_size_mb:

            if not files:

                break

            oldest = files.pop(0)

            try:

                os.remove(
                    oldest["path"]
                )

                total_size_mb -= (
                    oldest["size"] / (
                        1024 * 1024
                    )
                )

            except Exception:

                continue