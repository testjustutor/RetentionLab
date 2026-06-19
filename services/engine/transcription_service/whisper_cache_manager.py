# services/engine/transcription_service/whisper_cache_manager.py

import os
import json


class WhisperCacheManager:

    """
    Stores Whisper outputs.
    """

    @staticmethod
    def save(
        path,
        payload
    ):

        os.makedirs(

            os.path.dirname(path),

            exist_ok=True
        )

        with open(

            path,

            "w",

            encoding="utf-8"
        ) as file:

            json.dump(

                payload,

                file,

                indent=4
            )

    # ==========================================
    # LOAD
    # ==========================================

    @staticmethod
    def load(
        path
    ):

        with open(

            path,

            "r",

            encoding="utf-8"
        ) as file:

            return json.load(file)