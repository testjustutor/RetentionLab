from services.engine.cache.cache_expiration_manager import (
    CacheExpirationManager
)


def run_cache_cleanup_task(
    context
):

    monitored = [

        "cache_whisper",

        "cache_embeddings",

        "cache_voice_activity",

        "cache_diarization"
    ]

    for key in monitored:

        path = context.storage_paths.get(
            key
        )

        if not path:

            continue

        CacheExpirationManager.cleanup(
            path
        )