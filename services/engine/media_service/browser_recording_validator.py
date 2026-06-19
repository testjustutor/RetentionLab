# services/engine/media_service/browser_recording_validator.py

import os


class BrowserRecordingValidator:

    """
    Validates browser recordings.
    """

    @staticmethod
    def validate(
        path
    ):

        if not os.path.exists(path):

            return False

        size_mb = (

            os.path.getsize(path)
            / (1024 * 1024)
        )

        return size_mb > 1