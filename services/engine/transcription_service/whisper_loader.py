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

    # ==========================================
    # LOAD MODEL
    # ==========================================

    def load(self):

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

        if (
            self._MODEL is None
            or self._MODEL_NAME != model_name
        ):

            self._MODEL = whisper.load_model(
                model_name
            )

            self._MODEL_NAME = model_name

        return self._MODEL
