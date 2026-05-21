import os
import time


def run_cache_cleanup_task(context):

    """
    Removes stale cache files.
    """

    max_age_hours = 72

    now = time.time()

    cache_directories = [

        "cache_whisper",

        "cache_embeddings",

        "cache_audio_transcripts",

        "cache_voice_activity",

        "cache_diarization"
    ]

    for cache_key in cache_directories:

        directory = context.storage_paths.get(
            cache_key
        )

        if not directory:

            continue

        for file_name in os.listdir(
            directory
        ):

            file_path = os.path.join(
                directory,
                file_name
            )

            try:

                modified = os.path.getmtime(
                    file_path
                )

                age_hours = (
                    now - modified
                ) / 3600

                if age_hours > max_age_hours:

                    os.remove(
                        file_path
                    )

            except Exception:

                continue