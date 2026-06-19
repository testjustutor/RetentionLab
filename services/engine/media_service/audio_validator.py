# services/engine/media_service/audio_validator.py

import os


class AudioValidator:

    """
    Validates generated audio.
    """

    @staticmethod
    def validate(
        audio_path
    ):

        if not os.path.exists(
            audio_path
        ):

            raise FileNotFoundError(

                f"Audio missing: "
                f"{audio_path}"
            )

        size = os.path.getsize(
            audio_path
        )

        if size <= 0:

            raise RuntimeError(
                "Generated audio empty."
            )

        return True