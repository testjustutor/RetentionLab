# services/engine/services/diarization_engine.py

from utils.logger_util import log_with_type

import os
from .speaker_resolver import SpeakerResolver


class DiarizationEngine:

    """
    Builds diarization-compatible timeline data from Whisper segments.

    CLEANUP: this used to try an AssemblyAI backend first (via
    services/engine/transcriber.py) and only fall back to a non-diarized
    per-segment mapping if that failed. The AssemblyAI backend was never
    reachable in the live pipeline (transcription_task.py only ever calls
    .transcribe(), never .diarize(), so this class's process() was never
    even invoked), and services/engine/transcriber.py + its client.py/
    config.py/main.py support files have been removed as orphaned code -
    they referenced services/engine/pipeline.py, which was deleted in an
    earlier cleanup pass. This class now always builds the fallback,
    per-segment "Speaker 1" mapping (still resolved to real names via
    SpeakerResolver when a captions transcript is available).
    """

    def __init__(
        self,
        context
    ):

        self.context = context

        log_with_type("info", "Engine(transcription_service > diarization_engine) : DiarizationEngine initialized", "SERVICE")

    # ==========================================
    # PROCESS
    # ==========================================

    def process(
        self,
        audio_path,
        whisper_result=None
    ):

        log_with_type("info", f"Engine(transcription_service > diarization_engine) : Processing started audio_path={audio_path}", "SERVICE")

        segments = (
            whisper_result or {}
        ).get(
            "segments",
            []
        )

        log_with_type("info", "Engine(transcription_service > diarization_engine) : Using fallback diarization", "SERVICE")

        return self._build_fallback_diarization(segments)

    def _build_fallback_diarization(
        self,
        segments
    ):

        diarization = []

        for index, segment in enumerate(segments):
            start = round(segment.get("start", 0), 2)
            end = round(segment.get("end", start), 2)
            text = segment.get("text", "").strip()

            diarization.append({
                "start": start,
                "end": end,
                "speaker": "Speaker 1",
                "text": text,
                "source": "whisper_segment",
                "segment_index": index
            })

        log_with_type("info", f"Engine(transcription_service > diarization_engine) : Fallback diarization built count={len(diarization)}", "SERVICE")

        diarization = self._resolve_speaker_names(diarization)

        return diarization

    def _resolve_speaker_names(
        self,
        labeled
    ):
        """
        Resolves generic SPEAKER_XX labels to real speaker names using the
        platform captions transcript (TRANS_*.txt) stored in context.

        If no captions transcript is available, the labeled segments are
        returned unchanged and a warning is logged.
        """

        trans_path = getattr(self.context, "captions_trans_path", None)

        if not trans_path or not os.path.exists(trans_path):
            log_with_type("warning", "Engine(transcription_service > diarization_engine) : No captions transcript found — keeping SPEAKER_XX labels", "SERVICE")
            return labeled

        try:
            meeting_start = getattr(self.context, "meeting_start", None)

            resolver = SpeakerResolver(
                teams_trans_path=trans_path,
                meeting_start=meeting_start,
                verbose=False
            )

            labeled = resolver.resolve(labeled)

            log_with_type("info", f"Engine(transcription_service > diarization_engine) : Speaker names resolved mapping={resolver.speaker_map}", "SERVICE")

        except Exception as error:
            log_with_type("warning", f"Engine(transcription_service > diarization_engine) : Speaker resolution failed keeping SPEAKER_XX labels error={str(error)}", "SERVICE")

        return labeled