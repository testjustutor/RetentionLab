"""
services/python_engine/whisper_engine.py

Whisper speech-to-text, isolated from the legacy engine.
Uses faster-whisper when available and falls back to openai-whisper.
"""
from __future__ import annotations

import os
import json
from typing import Any, Dict, List, Optional

from utils.logger_util import log_with_type


class WhisperEngine:
    """Minimal Whisper wrapper producing segment-level transcripts."""

    def __init__(self, model_size: str = "base", device: str = "auto", language: Optional[str] = None,
                 progress_cb=None, initial_prompt: Optional[str] = None):
        self.model_size = model_size
        self.device = device
        # Confirmed: all sessions are in English
        self.language = language or os.getenv("PYTHON_ENGINE_LANGUAGE") or "en"
        self.model = None
        self.backend = None  # 'faster-whisper' | 'openai-whisper'
        # progress_cb(percent:int) -> called with coarse transcription progress
        self.progress_cb = progress_cb
        # Domain context prompt (reduces hallucinations)
        self.initial_prompt = initial_prompt

    # ------------------------------------------------------------------
    def _load(self) -> None:
        if self.model is not None:
            return

        device = self.device
        if device == "auto":
            try:
                import torch  # noqa

                device = "cuda" if torch.cuda.is_available() else "cpu"
            except Exception:
                device = "cpu"

        # 1) Prefer faster-whisper (cheaper + VAD built in)
        try:
            from faster_whisper import WhisperModel

            self.model = WhisperModel(self.model_size, device=device, compute_type="int8")
            self.backend = "faster-whisper"
            log_with_type("info", f"whisper_engine: using faster-whisper on {device}", "PYTHON_ENGINE")
            return
        except Exception:
            pass

        # 2) Fall back to openai-whisper
        try:
            import whisper

            self.model = whisper.load_model(self.model_size, device=device)
            self.backend = "openai-whisper"
            log_with_type("info", f"whisper_engine: using openai-whisper on {device}", "PYTHON_ENGINE")
            return
        except Exception as exc:  # pragma: no cover - env-dependent
            raise RuntimeError(
                "No Whisper backend available. Install 'faster-whisper' or 'openai-whisper': "
                "pip install faster-whisper openai-whisper"
            ) from exc

    # ------------------------------------------------------------------
    def _report(self, pct: int) -> None:
        """Emit transcription progress (0-100). Never raises."""
        try:
            if self.progress_cb:
                self.progress_cb(int(max(0, min(100, pct))))
        except Exception:
            pass

    def transcribe(self, audio_path: str) -> Dict[str, Any]:
        """Return {language, segments:[{start,end,text}], backend}."""
        self._load()
        self._report(0)
        if self.backend == "faster-whisper":
            return self._transcribe_faster(audio_path)
        return self._transcribe_openai(audio_path)

    def _transcribe_faster(self, audio_path: str) -> Dict[str, Any]:
        segments_iter, info = self.model.transcribe(
            audio_path,
            language=self.language,
            vad_filter=True,
            initial_prompt=self.initial_prompt,
            condition_on_previous_text=False,  # fewer hallucination cascades
            word_timestamps=True,  # needed so channel_transcriber gets real per-word timing
        )
        total = float(getattr(info, "duration", 0) or 0)
        last_pct = -1
        segments: List[Dict[str, Any]] = []
        for seg in segments_iter:
            text = (seg.text or "").strip()
            if not text:
                continue
            seg_words = [
                {"word": (w.word or "").strip(), "start": float(w.start), "end": float(w.end)}
                for w in (getattr(seg, "words", None) or [])
                if (w.word or "").strip()
            ]
            segments.append({
                "start": float(seg.start), "end": float(seg.end), "text": text,
                "words": seg_words,
            })
            # Real progress: how far into the audio we are
            if total > 0:
                pct = int(min(99, (float(seg.end) / total) * 100))
            else:
                pct = min(99, len(segments))
            if pct != last_pct and pct % 5 == 0:   # only every 5% (no spam)
                self._report(pct)
                last_pct = pct
        language = self.language or getattr(info, "language", None) or "en"
        return {"language": language, "segments": segments, "backend": self.backend}

    def _transcribe_openai(self, audio_path: str) -> Dict[str, Any]:
        # openai-whisper has no incremental iterator -> coarse steps only.
        self._report(30)
        result = self.model.transcribe(
            audio_path,
            language=self.language,
            initial_prompt=self.initial_prompt,
            condition_on_previous_text=False,
        )
        self._report(60)
        language = result.get("language") or self.language or "en"
        segments: List[Dict[str, Any]] = []
        for s in result.get("segments", []):
            text = (s.get("text") or "").strip()
            if not text:
                continue
            segments.append({"start": float(s["start"]), "end": float(s["end"]), "text": text})
        return {"language": language, "segments": segments, "backend": self.backend}


def parse_ai_config(ai_settings_json: Optional[str]) -> Dict[str, Any]:
    """Parse the Node bridge JSON blob defensively; never raises."""
    if not ai_settings_json:
        return {}
    try:
        cfg = json.loads(ai_settings_json)
        return cfg if isinstance(cfg, dict) else {}
    except Exception:
        return {}


def resolve_audio_path(raw_input: str) -> str:
    """Unwrap a possible '/storage/...' web path into a real filesystem path.

    We only ever trust the leaf name (never traversal), and resolve it against
    the project's 'storage/recordings' (or 'storage/screen-recordings') folder.
    """
    if not raw_input:
        return raw_input

    project_root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    leaf = os.path.basename(raw_input.replace("\\", "/"))
    candidates = [
        os.path.join(project_root, "storage", "recordings", leaf),
        os.path.join(project_root, "storage", "screen-recordings", leaf),
    ]
    for cand in candidates:
        if os.path.exists(cand):
            return cand
    # Default to recordings dir (caller may have moved the file already).
    return candidates[0]