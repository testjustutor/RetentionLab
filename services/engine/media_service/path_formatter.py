# services/engine/media_service/path_formatter.py

import os


def generate_output_name(
    base_id,
    suffix,
    extension
):

    return f"{base_id}_{suffix}.{extension}"


def build_storage_path(
    directory,
    filename
):

    return os.path.join(
        directory,
        filename
    )


class PathFormatter:

    @staticmethod
    def format_output_name(
        input_path
    ):

        base_name = os.path.splitext(
            os.path.basename(
                input_path
            )
        )[0]

        if base_name.startswith(
            "REC_"
        ):

            return "WAV_" + base_name[
                len("REC_"):
            ]

        return "WAV_" + base_name
