import os


class CacheHealthMonitor:

    """
    Monitors cache storage growth.

    Useful for:
    - production monitoring
    - debugging leaks
    - GPU/CPU temp artifact tracking
    - long-running bot systems

    Tracks:
    - total files
    - total directory size
    - largest cache folders
    """

    CACHE_DIRECTORIES = [

        "cache_whisper",

        "cache_diarization",

        "cache_embeddings",

        "cache_topic_trackers",

        "cache_voice_activity",

        "cache_captions_raw",

        "cache_audio_transcripts",

        "cache_audits"
    ]

    @classmethod
    def inspect(cls, project_root):

        storage_root = os.path.join(
            project_root,
            "storage"
        )

        report = {}

        print(
            "\n[CACHE HEALTH MONITOR] Inspecting cache footprint...",
            flush=True
        )

        for cache_dir in cls.CACHE_DIRECTORIES:

            target_dir = os.path.join(
                storage_root,
                cache_dir
            )

            if not os.path.exists(target_dir):

                continue

            stats = cls._calculate_directory_stats(
                target_dir
            )

            report[cache_dir] = stats

            print(
                f"[CACHE HEALTH] {cache_dir} | "
                f"files={stats['files']} | "
                f"size_mb={stats['size_mb']}",
                flush=True
            )

        print(
            "[CACHE HEALTH MONITOR] Inspection complete.\n",
            flush=True
        )

        return report

    # ==========================================
    # DIRECTORY STATS
    # ==========================================

    @classmethod
    def _calculate_directory_stats(
        cls,
        directory
    ):

        total_size = 0

        total_files = 0

        for root, _, files in os.walk(directory):

            for file_name in files:

                file_path = os.path.join(
                    root,
                    file_name
                )

                try:

                    total_size += os.path.getsize(
                        file_path
                    )

                    total_files += 1

                except Exception:

                    pass

        return {

            "files": total_files,

            "size_mb": round(
                total_size / (1024 * 1024),
                2
            )
        }