from pyannote.audio import Pipeline
import torch


class PyannoteDiarizer:

    """
    Speaker diarization using pyannote.
    """

    _PIPELINE = None

    def __init__(
        self,
        hf_token
    ):

        self.hf_token = hf_token

        self.device = torch.device(

            "cuda"
            if torch.cuda.is_available()
            else "cpu"
        )

    # ==========================================
    # LOAD
    # ==========================================

    def load(
        self
    ):

        if self._PIPELINE is None:

            self._PIPELINE = (
                Pipeline.from_pretrained(

                    "pyannote/speaker-diarization-3.1",

                    use_auth_token=(
                        self.hf_token
                    )
                )
            )

            self._PIPELINE.to(
                self.device
            )

        return self._PIPELINE

    # ==========================================
    # RUN
    # ==========================================

    def diarize(
        self,
        audio_path
    ):

        pipeline = self.load()

        diarization = pipeline(
            audio_path
        )

        segments = []

        for turn, _, speaker in (
            diarization.itertracks(
                yield_label=True
            )
        ):

            segments.append({

                "speaker": speaker,

                "start": round(
                    turn.start,
                    2
                ),

                "end": round(
                    turn.end,
                    2
                )
            })

        return segments