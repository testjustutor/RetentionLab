# root/services/engine/transcription_service/service.py

from utils.logger_util import log_with_type

from services.engine.transcription_service.whisper_loader import (
    WhisperLoader
)

from services.engine.transcription_service.whisper_runner import (
    WhisperRunner
)

from services.engine.transcription_service.diarization_engine import (
    DiarizationEngine
)

from services.engine.transcription_service.transcript_builder import (
    TranscriptBuilder
)


class TranscriptionService:

    """
    Main transcription pipeline.
    """

    def __init__(
        self,
        context
    ):

        self.context = context
        log_with_type("info", "Engine(transcription_service > service) : TranscriptionService initialized", "SERVICE")

    # ==========================================
    # MAIN PIPELINE
    # ==========================================

    def transcribe(
        self,
        audio_path
    ):
        log_with_type("info", f"Engine(transcription_service > service) : Transcription started audio_path={audio_path}", "SERVICE")

        loader = WhisperLoader(
            self.context
        )

        log_with_type("info", "Engine(transcription_service > service) : WhisperLoader loaded", "SERVICE")

        model = loader.load()

        log_with_type("info", "Engine(transcription_service > service) : Whisper model loaded", "SERVICE")

        runner = WhisperRunner(
            self.context
        )

        log_with_type("info", "Engine(transcription_service > service) : WhisperRunner initialized", "SERVICE")

        whisper_result = runner.run(
            model,
            audio_path
        )

        log_with_type("info", "Engine(transcription_service > service) : Whisper execution completed", "SERVICE")

        diarizer = DiarizationEngine(
            self.context
        )

        log_with_type("info", "Engine(transcription_service > service) : DiarizationEngine initialized", "SERVICE")

        diarization = diarizer.process(
            audio_path,
            whisper_result
        )

        log_with_type("info", "Engine(transcription_service > service) : Diarization completed", "SERVICE")

        builder = TranscriptBuilder(
            self.context
        )

        log_with_type("info", "Engine(transcription_service > service) : TranscriptBuilder initialized", "SERVICE")

        result = builder.build(
            whisper_result,
            diarization
        )

        log_with_type("info", "Engine(transcription_service > service) : Transcript built", "SERVICE")

        result[
            "whisper_result"
        ] = whisper_result

        log_with_type("info", "Engine(transcription_service > service) : Transcription pipeline finished", "SERVICE")

        return result
