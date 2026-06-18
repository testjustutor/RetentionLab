# services/engine/media_service/audio_merger.py

import subprocess


class AudioMerger:

    """
    Merges multiple audio files.
    """

    @staticmethod
    def merge(
        file_list_path,
        output_path
    ):

        command = [

            "ffmpeg",

            "-f",
            "concat",

            "-safe",
            "0",

            "-i",
            file_list_path,

            "-c",
            "copy",

            output_path
        ]

        subprocess.run(
            command,
            check=True
        )

        return output_path