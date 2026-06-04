# root/services/engine/transcription_service/diarization_engine.py

from utils.logger_util import log_with_type

import os
from .pyannote_diarizer import PyannoteDiarizer


class DiarizationEngine:

    """
    Builds diarization-compatible timeline data from Whisper segments.

    This class uses a real speaker diarization pipeline and assigns the
    resulting speaker labels back to Whisper segments.
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

        hf_token = None
        if hasattr(self.context, "ai_config") and isinstance(self.context.ai_config, dict):
            hf_token = self.context.ai_config.get("hf_token")

        if not hf_token:
            hf_token = os.getenv("HF_TOKEN")

        log_with_type("info", "Engine(transcription_service > diarization_engine) : HF token resolved", "SERVICE")

        try:
            diarizer = PyannoteDiarizer(hf_token)

            log_with_type("info", "Engine(transcription_service > diarization_engine) : PyannoteDiarizer initialized", "SERVICE")

            diarization_segments = diarizer.diarize(audio_path)

            log_with_type("info", f"Engine(transcription_service > diarization_engine) : Diarization segments received count={len(diarization_segments)}", "SERVICE")

        except Exception as error:
    
            log_with_type("warning", f"Engine(transcription_service > diarization_engine) : Pyannote failed fallback used error={str(error)}", "SERVICE")

            diarization_segments = []

        if not diarization_segments:

            log_with_type("info", "Engine(transcription_service > diarization_engine) : Using fallback diarization", "SERVICE")

            return self._build_fallback_diarization(segments)

        log_with_type("info", "Engine(transcription_service > diarization_engine) : Assigning speaker labels", "SERVICE")

        return self._assign_labels_to_segments(
            segments,
            diarization_segments
        )

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

        return diarization

    def _assign_labels_to_segments(
        self,
        segments,
        diarization_segments
    ):

        labeled = []

        for index, segment in enumerate(segments):
            start = round(segment.get("start", 0), 2)
            end = round(segment.get("end", start), 2)
            text = segment.get("text", "").strip()

            best_speaker = None
            best_overlap = 0.0

            for diarization_segment in diarization_segments:
                overlap_start = max(start, diarization_segment.get("start", 0.0))
                overlap_end = min(end, diarization_segment.get("end", end))
                overlap = max(0.0, overlap_end - overlap_start)

                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = diarization_segment.get("speaker")

            if best_speaker is None and diarization_segments:
                # Fallback to the nearest matched speaker by minimum temporal distance.
                segment_midpoint = (start + end) / 2.0
                closest_segment = min(
                    diarization_segments,
                    key=lambda s: abs(((s.get("start", 0.0) + s.get("end", 0.0)) / 2.0) - segment_midpoint)
                )
                best_speaker = closest_segment.get("speaker")

            labeled.append({
                "start": start,
                "end": end,
                "speaker": best_speaker or "Speaker 1",
                "text": text,
                "source": "pyannote_diarization",
                "segment_index": index
            })

        log_with_type("info", f"Engine(transcription_service > diarization_engine) : Label assignment completed count={len(labeled)}", "SERVICE")

        return labeled
