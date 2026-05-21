import subprocess
import json


class MediaMetadataReader:

    """
    Reads media metadata using ffprobe.
    """

    @staticmethod
    def read(
        input_path
    ):

        command = [

            "ffprobe",

            "-v",
            "quiet",

            "-print_format",
            "json",

            "-show_format",

            "-show_streams",

            input_path
        ]

        result = subprocess.run(

            command,

            capture_output=True,

            text=True
        )

        return json.loads(
            result.stdout
        )