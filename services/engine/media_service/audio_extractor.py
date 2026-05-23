import os
import subprocess


class AudioExtractor:

    """
    FFmpeg audio extractor.
    """

    def __init__(
        self,
        context
    ):

        self.context = context

    # ==========================================
    # EXTRACT AUDIO
    # ==========================================

    def extract(
        self,
        input_path
    ):

        output_path = os.path.join(

            self.context.storage_paths[
                "wav_audio"
            ],

            f"{self.context.base_id}.wav"
        )

        command = [

            "ffmpeg",

            "-y",

            "-i",
            input_path,

            "-ac",
            "1",

            "-ar",
            "16000",

            output_path
        ]

        subprocess.run(

            command,

            check=True,

            stdout=subprocess.DEVNULL,

            stderr=subprocess.DEVNULL
        )

        return output_path
