import os

from services.engine.media_service.file_validator import (
    validate_file
)

from services.engine.media_service.audio_extractor import (
    AudioExtractor
)

from services.engine.media_service.audio_normalizer import (
    AudioNormalizer
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

        normalized_path = os.path.join(
            self.context.storage_paths[
                "wav_audio"
            ],
            f"WAV_{self.context.base_id}.wav"
        )

        normalized_audio = (
            AudioNormalizer.normalize(
                wav_audio,
                normalized_path
            )
        )

        return {

            "audio_path": (
                normalized_audio
            )
        }
