# root/services/engine/shared/runtime_constants.py

class RuntimeConstants:

    """
    Shared runtime constants.
    """

    MAX_PARALLEL_TASKS = 4

    CACHE_RETENTION_HOURS = 72

    WHISPER_MODEL = "large-v3"

    SUPPORTED_AUDIO_FORMATS = [

        ".mp3",

        ".wav",

        ".mp4",

        ".mkv",

        ".webm",

        ".m4a"
    ]