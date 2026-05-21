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

    # ==========================================
    # MAIN PIPELINE
    # ==========================================

    def transcribe(
        self,
        audio_path
    ):

        loader = WhisperLoader(
            self.context
        )

        model = loader.load()

        runner = WhisperRunner(
            self.context
        )

        whisper_result = runner.run(

            model,
            audio_path
        )

        diarizer = DiarizationEngine(
            self.context
        )

        diarization = diarizer.process(
            audio_path,
            whisper_result
        )

        builder = TranscriptBuilder(
            self.context
        )

        result = builder.build(

            whisper_result,

            diarization
        )

        result[
            "whisper_result"
        ] = whisper_result

        return result
