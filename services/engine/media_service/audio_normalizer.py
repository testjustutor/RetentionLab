# services/engine/media_service/audio_normalizer.py

import subprocess


class AudioNormalizer:

    """
    Normalizes audio loudness.
    """

    @staticmethod
    def normalize(
        input_path,
        output_path
    ):

        command = [

            "ffmpeg",

            "-y",

            "-hide_banner",

            "-loglevel",
            "error",

            "-i",
            input_path,

            "-af",
            "loudnorm",

            "-ac",
            "1",

            "-ar",
            "16000",

            output_path
        ]

        subprocess.run(
            command,
            check=True
        )

        return output_path
