import whisperx
import torch


class WhisperXAligner:

    """
    Word-level timestamp alignment.
    """

    def __init__(
        self
    ):

        self.device = (
            "cuda"
            if torch.cuda.is_available()
            else "cpu"
        )

    # ==========================================
    # ALIGN
    # ==========================================

    def align(
        self,
        transcript,
        audio_path
    ):

        model, metadata = (

            whisperx.load_align_model(

                language_code="en",

                device=self.device
            )
        )

        return whisperx.align(

            transcript["segments"],

            model,

            metadata,

            audio_path,

            self.device
        )