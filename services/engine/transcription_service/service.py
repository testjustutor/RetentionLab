# root/services/engine/transcription_service/service.py

from utils.logger_util import log_with_type

import os

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
        """Whisper speech-to-text only — returns plain transcript (no speaker labels)."""
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

        builder = TranscriptBuilder(
            self.context
        )

        result = builder.build_plain_text(
            whisper_result
        )

        result["whisper_result"] = whisper_result

        log_with_type("info", "Engine(transcription_service > service) : Transcription pipeline finished (plain text)", "SERVICE")

        return result

    # ==========================================
    # DIARIZATION PIPELINE
    # ==========================================

    def diarize(
        self,
        audio_path,
        whisper_result=None
    ):
        """pyannote speaker diarization + talk_ratio computation.
        
        If whisper_result is not provided, loads it from the cached
        WHISPER_{base_id}.json file via context.whisper_path.
        """
        log_with_type("info", f"Engine(transcription_service > service) : Diarization started audio_path={audio_path}", "SERVICE")

        if whisper_result is None:
            whisper_path = getattr(self.context, "whisper_path", None)
            if whisper_path and os.path.exists(whisper_path):
                import json
                with open(whisper_path, "r", encoding="utf-8") as f:
                    whisper_result = json.load(f)
                log_with_type("info", "Engine(transcription_service > service) : Whisper result loaded from cache for diarization", "SERVICE")
            else:
                whisper_result = {"segments": []}
                log_with_type("warning", "Engine(transcription_service > service) : No whisper result available for diarization", "SERVICE")

        diarizer = DiarizationEngine(
            self.context
        )

        log_with_type("info", "Engine(transcription_service > service) : DiarizationEngine initialized", "SERVICE")

        diarization = diarizer.process(
            audio_path,
            whisper_result
        )

        log_with_type("info", "Engine(transcription_service > service) : Diarization completed", "SERVICE")

        talk_ratio = TranscriptBuilder.compute_talk_ratio(
            diarization
        )

        log_with_type("info", "Engine(transcription_service > service) : Talk ratio computed", "SERVICE")

        return {
            "whisper_result": whisper_result,
            "diarization": diarization,
            "talk_ratio": talk_ratio
        }
