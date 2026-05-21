import os
import subprocess


class AudioChunker:

    """
    Splits long audio files.
    """

    @staticmethod
    def split(
        input_path,
        output_dir,
        segment_seconds=600
    ):

        os.makedirs(
            output_dir,
            exist_ok=True
        )

        output_pattern = os.path.join(

            output_dir,

            "chunk_%03d.wav"
        )

        command = [

            "ffmpeg",

            "-i",
            input_path,

            "-f",
            "segment",

            "-segment_time",
            str(segment_seconds),

            "-c",
            "copy",

            output_pattern
        ]

        subprocess.run(
            command,
            check=True
        )

        return output_dir