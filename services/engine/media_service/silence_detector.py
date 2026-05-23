import subprocess


class SilenceDetector:

    """
    Detects silence in media.
    """

    @staticmethod
    def analyze(
        input_path
    ):

        command = [

            "ffmpeg",

            "-i",
            input_path,

            "-af",
            "silencedetect=n=-50dB:d=1",

            "-f",
            "null",

            "-"
        ]

        result = subprocess.run(

            command,

            stderr=subprocess.PIPE,

            stdout=subprocess.PIPE,

            text=True
        )

        return result.stderr