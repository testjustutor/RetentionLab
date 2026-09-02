# services/engine/services/file_validator.py

import os


def validate_file(
    input_path
):

    if not os.path.exists(
        input_path
    ):

        raise FileNotFoundError(

            f"Input missing: "
            f"{input_path}"
        )

    return input_path


class FileValidator:

    def __init__(
        self,
        recordings_dir
    ):

        self.recordings_dir = recordings_dir

    def verify_path(
        self,
        file_name
    ):

        input_path = file_name

        if not os.path.isabs(
            input_path
        ):

            input_path = os.path.join(
                self.recordings_dir,
                file_name
            )

        return validate_file(
            input_path
        )
