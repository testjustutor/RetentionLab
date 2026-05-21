import whisperx
import torch


class WhisperXRunner:

    """
    WhisperX accelerated runner.
    """

    def __init__(
        self,
        context
    ):

        self.context = context

        self.device = (
            "cuda"
            if torch.cuda.is_available()
            else "cpu"
        )

    # ==========================================
    # LOAD MODEL
    # ==========================================

    def load_model(
        self
    ):

        return whisperx.load_model(

            "large-v2",

            self.device,

            compute_type="float16"
        )

    # ==========================================
    # TRANSCRIBE
    # ==========================================

    def transcribe(
        self,
        audio_path
    ):

        model = self.load_model()

        audio = whisperx.load_audio(
            audio_path
        )

        return model.transcribe(
            audio
        )