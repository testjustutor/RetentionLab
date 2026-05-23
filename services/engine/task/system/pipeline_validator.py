import os


class PipelineValidator:

    """
    Validates pipeline inputs.
    """

    @staticmethod
    def validate(context):

        if not context.input_file:

            raise RuntimeError(
                "Input file missing."
            )

        recording_path = os.path.join(

            context.storage_paths[
                "recordings"
            ],

            context.input_file
        )

        if not os.path.exists(
            recording_path
        ):

            raise FileNotFoundError(

                f"Recording not found: "
                f"{recording_path}"
            )