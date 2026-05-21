import os
import shutil
from datetime import datetime, timedelta


class CacheCleanupTask:

    """
    Cleans old cache artifacts safely.

    Prevents:
    - disk bloating
    - stale AI artifacts
    - abandoned temp files

    Safe for:
    - Whisper cache
    - diarization cache
    - embeddings cache
    - topic trackers
    """

    CACHE_DIRECTORIES = [

        "cache_whisper",

        "cache_diarization",

        "cache_embeddings",

        "cache_topic_trackers",

        "cache_voice_activity",

        "cache_captions_raw"
    ]

    @classmethod
    def cleanup(
        cls,
        project_root,
        max_age_hours=48
    ):

        storage_root = os.path.join(
            project_root,
            "storage"
        )

        expiration_time = (
            datetime.utcnow()
            - timedelta(hours=max_age_hours)
        )

        print(
            "\n[CACHE CLEANUP] Starting cleanup cycle...",
            flush=True
        )

        for cache_dir in cls.CACHE_DIRECTORIES:

            target_dir = os.path.join(
                storage_root,
                cache_dir
            )

            if not os.path.exists(target_dir):

                continue

            cls._cleanup_directory(
                target_dir,
                expiration_time
            )

        print(
            "[CACHE CLEANUP] Cleanup completed.\n",
            flush=True
        )

    # ==========================================
    # DIRECTORY CLEANUP
    # ==========================================

    @classmethod
    def _cleanup_directory(
        cls,
        directory,
        expiration_time
    ):

        for item_name in os.listdir(directory):

            item_path = os.path.join(
                directory,
                item_name
            )

            try:

                modified_time = datetime.utcfromtimestamp(
                    os.path.getmtime(item_path)
                )

                if modified_time > expiration_time:

                    continue

                # ==========================================
                # REMOVE FILE
                # ==========================================

                if os.path.isfile(item_path):

                    os.remove(item_path)

                    print(
                        f"[CACHE CLEANUP] Removed file: {item_path}",
                        flush=True
                    )

                # ==========================================
                # REMOVE DIRECTORY
                # ==========================================

                elif os.path.isdir(item_path):

                    shutil.rmtree(item_path)

                    print(
                        f"[CACHE CLEANUP] Removed directory: {item_path}",
                        flush=True
                    )

            except Exception as error:

                print(
                    f"[CACHE CLEANUP ERROR] {item_path}: {str(error)}",
                    flush=True
                )