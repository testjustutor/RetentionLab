# services/engine/media_service/service.py

import os

from services.engine.media_service.file_validator import (
    validate_file
)

from services.engine.media_service.audio_extractor import (
    AudioExtractor
)


class MediaService:

    """
    Main media orchestration service.
    """

    def __init__(
        self,
        context
    ):

        self.context = context

    # ==========================================
    # MAIN PROCESS
    # ==========================================

    def process(
        self,
        input_file
    ):

        if not os.path.isabs(
            input_file
        ):

            input_file = os.path.join(
                self.context.storage_paths[
                    "recordings"
                ],
                input_file
            )

        validated = validate_file(
            input_file
        )

        extractor = AudioExtractor(
            self.context
        )

        wav_audio = extractor.extract(
            validated
        )

        return {
            "audio_path": wav_audio
        }
