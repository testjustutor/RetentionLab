"""
services/python_engine/whisperx_engine.py

Word-level transcription + speaker assignment using WhisperX.

Pipeline inside this engine:
    1. Whisper (faster-whisper backend) transcription
    2. Forced word-level alignment (precise per-word timestamps)
    3. pyannote 3.1 diarization with FORCED speaker count (num_speakers=2)
    4. Each WORD is assigned to a speaker by its timestamp - so a segment that
       spans two speaker turns no longer gets tagged as a single speaker.

This replaces segment-level merging, which was mislabelling alternating
tutor/student turns.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from utils.logger_util import log_with_type

# Domain vocabulary passed to Whisper as initial_prompt to reduce hallucinations.
# Configurable per subject via ai_settings["subject"] / env PYTHON_ENGINE_SUBJECT.
SUBJECT_PROMPTS: Dict[str, str] = {
    "math": (
        "This is a math tutoring session. Topics include equations, graphs, "
        "coordinates, x-axis, y-axis, variables, plotting points, linear equations, "
        "solutions, slope, intercept."
    ),
    "science": (
        "This is a science tutoring session covering physics, chemistry and biology terms."
    ),
    "english": (
        "This is an English tutoring session covering grammar, reading comprehension and writing."
    ),
}
DEFAULT_PROMPT = "This is a one-to-one tutoring session between a tutor and a student."


def get_initial_prompt(subject: Optional[str] = None) -> str:
    """Return the domain-context initial prompt for the given subject."""
    key = (subject or os.getenv("PYTHON_ENGINE_SUBJECT") or "math").lower().strip()
    return SUBJECT_PROMPTS.get(key, DEFAULT_PROMPT)


class WhisperXEngine:
    """WhisperX transcription + pyannote diarization with forced speaker count."""

    def __init__(
        self,
        model_size: str = "large-v3",
        device: str = "auto",
        language: Optional[str] = None,
        num_speakers: int = 2,
        initial_prompt: Optional[str] = None,
        batch_size: int = 8,
        progress_cb=None,
        speaker_names: Optional[List[str]] = None,
    ):
        self.model_size = model_size
        self.device = device
        # Confirmed: all sessions are in English
        self.language = language or os.getenv("PYTHON_ENGINE_LANGUAGE") or "en"
        self.num_speakers = int(num_speakers or 2)
        self.initial_prompt = initial_prompt or get_initial_prompt()
        self.batch_size = int(batch_size or 8)
        self.progress_cb = progress_cb
        self.hf_token = os.getenv("HF_TOKEN") or None
        # Role labels: assigned by talk-time dominance -> Speaker 1, Speaker 2, ...
        self.speaker_names = speaker_names or ["Speaker 1", "Speaker 2"]
        log_with_type("info", f"whisperx_engine: init model={self.model_size} num_speakers={self.num_speakers}", "PYTHON_ENGINE")

    def _report(self, pct: int) -> None:
        try:
            if self.progress_cb:
                self.progress_cb(int(max(0, min(100, pct))))
        except Exception:
            pass

    def _resolve_device(self) -> str:
        if self.device != "auto":
            return self.device
        try:
            import torch
            return "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            return "cpu"
# ------------------------------------------------------------------
    def transcribe_and_diarize(self, audio_path: str) -> Dict[str, Any]:
        """Run whisper transcribe -> align -> diarize -> word-level speaker map."""
        try:
            import whisperx
        except Exception as exc:
            raise RuntimeError(
                "whisperx is not installed. Install with: pip install whisperx"
            ) from exc

        device = self._resolve_device()
        compute_type = "float16" if device == "cuda" else "int8"
        log_with_type("info", f"whisperx_engine: loading model {self.model_size} on {device} ({compute_type})", "PYTHON_ENGINE")

        model = whisperx.load_model(
            self.model_size, device, compute_type=compute_type, language=self.language
        )
        audio = whisperx.load_audio(audio_path)

        self._report(15)
        # condition_on_previous_text=False -> fewer hallucination cascades and faster
        result = model.transcribe(
            audio,
            batch_size=self.batch_size,
            initial_prompt=self.initial_prompt,
            condition_on_previous_text=False,
        )
        language = result.get("language") or self.language or "en"
        self._report(45)

        # ---- Word-level alignment ----
        log_with_type("info", f"whisperx_engine: aligning words (lang={language})", "PYTHON_ENGINE")
        try:
            model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=device)
            result = whisperx.align(
                result["segments"], model_a, metadata, audio, device, return_char_alignments=False
            )
        except Exception as exc:
            log_with_type("warning", f"whisperx_engine: alignment unavailable ({exc}) - continuing with segment timings", "PYTHON_ENGINE")

        self._report(60)

        # ---- Diarization (forced 2 speakers) ----
        log_with_type("info", f"whisperx_engine: diarizing with num_speakers={self.num_speakers}", "PYTHON_ENGINE")
        try:
            diarize_pipeline = whisperx.DiarizationPipeline(use_auth_token=self.hf_token, device=device)
            diar_segments = diarize_pipeline(audio, min_speakers=self.num_speakers, max_speakers=self.num_speakers)
        except Exception as exc:
            log_with_type("error", f"whisperx_engine: diarization failed -> {exc}", "PYTHON_ENGINE")
            diar_segments = []

        segments = self._assign_speakers(result.get("segments", []), diar_segments)
        segments = self._apply_role_labels(segments)
        self._report(70)

        words = []
        for seg in result.get("segments", []):
            for w in seg.get("words", []) or []:
                if w.get("word"):
                    words.append({
                        "word": w["word"].strip(),
                        "start": float(w.get("start") or 0),
                        "end": float(w.get("end") or 0),
                        "speaker": w.get("speaker"),
                    })

        return {
            "language": language,
            "segments": segments,
            "words": words,
            "backend": "whisperx",
            "num_speakers_forced": self.num_speakers,
        }

    # ------------------------------------------------------------------
    @staticmethod
    def _apply_role_labels(segments: List[Dict[str, Any]],
                           speaker_names: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Map generic SPEAKER_xx cluster labels to stable, human-facing labels
        (Speaker 1 / Speaker 2 / ...), ordered by total talk time descending
        (most talk time -> Speaker 1)."""
        names = speaker_names or ["Speaker 1", "Speaker 2"]
        totals: Dict[str, float] = {}
        for seg in segments or []:
            spk = seg.get("speaker") or "SPEAKER_00"
            dur = max(0.0, float(seg.get("end", 0)) - float(seg.get("start", 0)))
            totals[spk] = totals.get(spk, 0.0) + dur
        if not totals:
            return segments

        # Sort by talk time descending -> [Tutor, Student]
        ordered = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
        mapping = {spk: (names[i] if i < len(names) else f"SPEAKER_{i:02d}")
                   for i, (spk, _) in enumerate(ordered)}

        for seg in segments or []:
            # Use the same normalized key as the totals pass so entries without an
            # explicit speaker (None) map to "SPEAKER_00" -> "Speaker 1" instead of
            # being assigned None (which would collapse the transcript to SPEAKER_00).
            key = seg.get("speaker") or "SPEAKER_00"
            seg["speaker"] = mapping.get(key, seg.get("speaker"))
            for w in seg.get("words", []) or []:
                wkey = w.get("speaker") or "SPEAKER_00"
                if wkey in mapping:
                    w["speaker"] = mapping[wkey]
        return segments

    @staticmethod
    def _assign_speakers(segments: List[Dict[str, Any]], diar_segments) -> List[Dict[str, Any]]:
        """Assign each WORD to a speaker from the pyannote turns; a segment's
        label is the majority of its words (fixes mixed-turn segments)."""
        turns = [
            {"start": float(t.get("start", 0)), "end": float(t.get("end", 0)),
             "speaker": t.get("speaker") or "SPEAKER_00"}
            for t in (diar_segments or [])
        ]

        def speaker_at(midpoint: float):
            best = None
            best_gap = None
            for t in turns:
                if t["start"] <= midpoint <= t["end"]:
                    return t["speaker"]
                gap = min(abs(t["start"] - midpoint), abs(t["end"] - midpoint))
                if best_gap is None or gap < best_gap:
                    best_gap = gap
                    best = t["speaker"]
            return best

        out = []
        for seg in segments:
            words = seg.get("words", []) or []
            counts: Dict[str, int] = {}
            for w in words:
                mid = ((w.get("start") or 0) + (w.get("end") or 0)) / 2.0
                spk = w.get("speaker") or speaker_at(mid) or "SPEAKER_00"
                counts[spk] = counts.get(spk, 0) + 1
            speaker = max(counts.items(), key=lambda kv: kv[1])[0] if counts else (
                speaker_at(float(seg.get("start", 0))) or "SPEAKER_00")
            text = (seg.get("text") or "").strip()
            if not text:
                continue
            out.append({
                "start": float(seg.get("start", 0)),
                "end": float(seg.get("end", 0)),
                "text": text,
                "speaker": speaker,
            })
        return out