# services/engine/services/whisper_runner.py

from utils.logger_util import log_with_type

class WhisperRunner:

    """
    Executes Whisper inference.
    """

    def __init__(
        self,
        context
    ):

        self.context = context
        log_with_type("info", "Engine(transcription_service > whisper_runner) : WhisperRunner initialized", "SERVICE")

    # ==========================================
    # RUN INFERENCE
    # ==========================================

    def run(
        self,
        model,
        audio_path
    ):

        log_with_type("info", f"Engine(transcription_service > whisper_runner) : Transcription started audio_path={audio_path}", "SERVICE")

        result = model.transcribe(
            audio_path,
            verbose=False
        )

        log_with_type("info", "Engine(transcription_service > whisper_runner) : Transcription completed", "SERVICE")

        return result