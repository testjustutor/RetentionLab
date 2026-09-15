# services/engine/services/media.py

import os

from services.engine.services.file_validator import (
    validate_file
)

from services.engine.services.audio_extractor import (
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

        # NOTE: "audio_path" is the CANONICAL recording (storage/recordings/REC_...)
        # - this is what gets persisted to meeting_assets.audio_path, so it must
        # stay the original recording, not the extracted cache file. The
        # normalized/mono 16kHz WAV that Whisper actually needs is returned
        # separately as "wav_audio_path" (an internal cache artifact only -
        # there is no DB column for it).
        return {
            "audio_path": validated,
            "wav_audio_path": wav_audio
        }
