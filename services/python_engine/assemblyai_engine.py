"""
services/python_engine/assemblyai_engine.py

Transcription + speaker diarization via AssemblyAI. Mirrors the
WhisperXEngine interface so it slots into pipeline.run_pipeline as an
opt-in backend:

    AssemblyAIEngine(...).transcribe_and_diarize(audio_path)
        -> {language, segments, words, backend, num_speakers_forced}

* Single-channel audio  -> speaker_labels=True with speakers_expected=N
  (forced diarization to exactly 2 speakers for 1:1 tutor/student calls).
* Stereo L/R (two mics) -> multichannel=True: AssemblyAI transcribes each
  channel independently server-side. This replaces the manual ffmpeg split
  + per-channel Whisper pass in channel_transcriber.py.

speaker_labels and multichannel are mutually exclusive on the AssemblyAI API.

`assemblyai` is OPTIONAL: lazy-imported inside __init__, so a missing package
or unset ASSEMBLYAI_API_KEY raises and the caller's try/except falls back to
the local WhisperX/Whisper path. Enable with PYTHON_ENGINE_USE_ASSEMBLYAI=1.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

# Standalone engine: load its own credentials from the project .env
# (same pattern as services/python_deepgram/transcriber.py).
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"))
except Exception:
    pass

from utils.logger_util import log_with_type


class AssemblyAIEngine:
    """AssemblyAI transcription + diarization (forced 2 speakers, or per-channel)."""

    def __init__(
        self,
        num_speakers: int = 2,
        language: Optional[str] = None,
        multichannel: bool = False,
        speaker_names: Optional[List[str]] = None,
        word_boost: Optional[List[str]] = None,
    ):
        # Lazy import: keep this module importable even when `assemblyai` is
        # not installed (mirrors whisperx_engine deferring `import whisperx`).
        try:
            import assemblyai as aai
        except Exception as exc:  # pragma: no cover - environment dependent
            raise RuntimeError(
                "assemblyai is not installed. Install with: pip install assemblyai"
            ) from exc

        api_key = os.getenv("ASSEMBLYAI_API_KEY")
        if not api_key:
            raise RuntimeError("ASSEMBLYAI_API_KEY not configured")

        aai.settings.api_key = api_key
        self.aai = aai
        self.num_speakers = int(num_speakers or 2)
        # Confirmed: all sessions are in English.
        self.language = language or os.getenv("PYTHON_ENGINE_LANGUAGE") or "en"
        self.multichannel = bool(multichannel)
        self.speaker_names = speaker_names or ["Speaker 1", "Speaker 2"]
        # Known terms (participant names, subject jargon) to bias recognition
        # toward - fixes proper-name errors like "Abir" -> "Abhijit".
        self.word_boost = [str(w).strip() for w in (word_boost or []) if str(w).strip()] or None
        # Stable first-seen mapping of a raw speaker/channel key -> label so the
        # same participant keeps the same name across every utterance/word.
        self._seen: Dict[str, str] = {}
        log_with_type(
            "info",
            f"assemblyai_engine: init (multichannel={self.multichannel}, "
            f"num_speakers={self.num_speakers}, language={self.language})",
            "PYTHON_ENGINE",
        )

    def _speaker_key(self, obj: Any) -> str:
        """Raw key identifying a speaker/channel on the given SDK object.

        For multichannel audio the channel number *is* the participant id; for
        diarization the cluster label (e.g. 'A') is."""
        if self.multichannel:
            ch = getattr(obj, "channel", None)
            return f"channel_{ch}" if ch is not None else "channel_unknown"
        return getattr(obj, "speaker", None) or "speaker_unknown"

    def _label(self, key: str) -> str:
        if key not in self._seen:
            idx = len(self._seen)
            self._seen[key] = (
                self.speaker_names[idx]
                if idx < len(self.speaker_names)
                else f"SPEAKER_{idx:02d}"
            )
        return self._seen[key]

    def transcribe_and_diarize(self, audio_path: str) -> Dict[str, Any]:
        """Transcribe (+ diarize, or per-channel transcribe) via AssemblyAI.

        Returns the same shape WhisperXEngine returns so the rest of the
        pipeline (alignment, storage_output, audit, health_check) is unchanged.
        """
        aai = self.aai

        # speaker_labels (forced diarization) and multichannel are mutually
        # exclusive on the AssemblyAI API.
        config_kwargs: Dict[str, Any] = dict(
            language_code=self.language,
            speaker_labels=not self.multichannel,
            speakers_expected=self.num_speakers if not self.multichannel else None,
            multichannel=self.multichannel,
        )
        if self.word_boost:
            # Bias recognition toward known names/terms (e.g. "Abir").
            config_kwargs["word_boost"] = self.word_boost
        config = aai.TranscriptionConfig(**config_kwargs)

        log_with_type(
            "info",
            f"assemblyai_engine: submitting (multichannel={self.multichannel}, "
            f"word_boost={self.word_boost})",
            "PYTHON_ENGINE",
        )
        # Synchronous: the SDK polls until the transcript is complete.
        transcript = aai.Transcriber(config=config).transcribe(audio_path)

        if transcript.status == aai.TranscriptStatus.error:
            raise RuntimeError(f"AssemblyAI failed: {transcript.error}")

        segments: List[Dict[str, Any]] = []
        words: List[Dict[str, Any]] = []

        # Utterances give time-stamped, speaker/channel-labelled text chunks.
        for u in (transcript.utterances or []):
            speaker = self._label(self._speaker_key(u))
            segments.append({
                "start": float(getattr(u, "start", 0) or 0) / 1000.0,
                "end": float(getattr(u, "end", 0) or 0) / 1000.0,
                "text": (getattr(u, "text", "") or "").strip(),
                "speaker": speaker,
            })

        # Word-level timestamps (flat list) - keep in sync with the segments'
        # speaker labels so downstream audit/health-check see consistent turns.
        for w in (transcript.words or []):
            speaker = self._label(self._speaker_key(w))
            words.append({
                "word": (getattr(w, "text", "") or "").strip(),
                "start": float(getattr(w, "start", 0) or 0) / 1000.0,
                "end": float(getattr(w, "end", 0) or 0) / 1000.0,
                "speaker": speaker,
            })

        language = self.language
        try:
            language = transcript.json_response.get("language_code") or language
        except Exception:
            pass

        return {
            "language": language,
            "segments": segments,
            "words": words,
            "backend": "assemblyai",
            "num_speakers_forced": self.num_speakers,
        }
