# services/engine/services/diarization_engine.py

from utils.logger_util import log_with_type

import os
from .speaker_resolver import SpeakerResolver


class DiarizationEngine:

    """
    Builds diarization-compatible timeline data from Whisper segments.

    Prefers a real speaker-diarization backend (AssemblyAI) and assigns the
    resulting speaker labels back to Whisper segments. Falls back to a
    non-diarized per-segment mapping when no backend is available, so the
    pipeline never crashes on a missing module.
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

        try:
            # AssemblyAI diarization (preferred; no local diarization model)
            diarization_segments = self._try_assemblyai(audio_path)

        except Exception as error:

            log_with_type("warning", f"Engine(transcription_service > diarization_engine) : AssemblyAI diarization failed error={str(error)}", "SERVICE")

            diarization_segments = []

        if not diarization_segments:

            log_with_type("info", "Engine(transcription_service > diarization_engine) : Using fallback diarization", "SERVICE")

            return self._build_fallback_diarization(segments)

        log_with_type("info", "Engine(transcription_service > diarization_engine) : Assigning speaker labels", "SERVICE")

        labeled = self._assign_labels_to_segments(
            segments,
            diarization_segments
        )

        labeled = self._resolve_speaker_names(labeled)

        return labeled

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

    # ==========================================
    # ASSEMBLYAI DIARIZATION
    # ==========================================
    def _try_assemblyai(self, audio_path):
        """Run diarization via services/engine/assemblyai_engine if it is importable."""
        try:
            from services.engine.assemblyai_engine.transcriber import (
                transcribe_and_diarize,
            )

            result = transcribe_and_diarize(
                audio_path,
                num_speakers=2,
                language=self._context_language(),
            )

            if not result or not result.get("success", True):
                log_with_type("warning", f"Engine(transcription_service > diarization_engine) : AssemblyAI diarization returned no result error={result and result.get('error')}", "SERVICE")
                return []

            # Normalize AssemblyAI segments -> { start, end, speaker }
            normalized = []
            for seg in (result.get("segments") or []):
                speaker = seg.get("speaker")
                if not speaker:
                    continue
                normalized.append({
                    "start": float(seg.get("start", 0)),
                    "end": float(seg.get("end", 0)),
                    "speaker": speaker,
                })
            log_with_type("info", f"Engine(transcription_service > diarization_engine) : AssemblyAI diarization segments count={len(normalized)}", "SERVICE")
            return normalized
        except Exception as error:
            log_with_type("warning", f"Engine(transcription_service > diarization_engine) : AssemblyAI diarization failed error={str(error)}", "SERVICE")
            return []

    def _context_language(self):
        try:
            ai_config = getattr(self.context, "ai_config", None)
            if isinstance(ai_config, dict):
                lang = ai_config.get("language") or ai_config.get("language_code")
                if lang:
                    return lang
        except Exception:
            pass
        return "en"

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
                "source": "diarization",
                "segment_index": index
            })

        log_with_type("info", f"Engine(transcription_service > diarization_engine) : Label assignment completed count={len(labeled)}", "SERVICE")

        return labeled