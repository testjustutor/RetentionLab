# root/services/engine/transcription_service/whisper_loader.py

from utils.logger_util import log_with_type

import whisper
import os

class WhisperLoader:

    """
    Loads Whisper model.
    """

    _MODEL = None
    _MODEL_NAME = None

    def __init__(
        self,
        context=None
    ):

        self.context = context
        log_with_type("info", "Engine(transcription_service > whisper_loader) : WhisperLoader initialized", "SERVICE")

    # ==========================================
    # LOAD MODEL
    # ==========================================

    def load(self):

        log_with_type("info", "Engine(transcription_service > whisper_loader) : Model load requested", "SERVICE")

        configured_model = None

        if self.context is not None:

            configured_model = self.context.ai_config.get(
                "whisper_model"
            )

        model_name = (
            configured_model
            or os.getenv("WHISPER_MODEL")
            or "base"
        )

        log_with_type("info", f"Engine(transcription_service > whisper_loader) : Selected model={model_name}", "SERVICE")

        if (
            self._MODEL is None
            or self._MODEL_NAME != model_name
        ):

            log_with_type("info", "Engine(transcription_service > whisper_loader) : Loading Whisper model (cold start)", "SERVICE")

            self._MODEL = whisper.load_model(
                model_name
            )

            self._MODEL_NAME = model_name
            
            log_with_type("info", "Engine(transcription_service > whisper_loader) : Whisper model loaded", "SERVICE")

        else:

            log_with_type("info", "Engine(transcription_service > whisper_loader) : Using cached Whisper model", "SERVICE")

        return self._MODEL
