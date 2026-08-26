"""
services/assemblyai_engine/transcriber.py

Main entry point, mirrors WhisperXEngine.transcribe_and_diarize() so it's a
drop-in alternative backend for services/python_engine/pipeline.py.

Also exposes raw audio-intelligence fields (sentiment, entities, chapters,
summary, topics, content_safety) for callers who want more than just the
transcript+diarization shape.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional

from .client import AssemblyAIClient
from utils.logger_util import log_with_type


def _speaker_label(raw_key, seen: Dict[str, str], speaker_names: List[str]) -> str:
    if raw_key not in seen:
        idx = len(seen)
        seen[raw_key] = speaker_names[idx] if idx < len(speaker_names) else f"SPEAKER_{idx:02d}"
    return seen[raw_key]


def transcribe_and_diarize(
    audio_path: str,
    num_speakers: int = 2,
    language: Optional[str] = None,
    multichannel: bool = False,
    speaker_names: Optional[List[str]] = None,
    extra_opts: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Returns {language, segments, words, backend, num_speakers_forced,
    plus optional: sentiment, entities, chapters, summary, topics, safety_labels}
    Segments/words shape matches whisperx_engine.py's output so it can slot
    directly into services/python_engine/pipeline.py's transcript variable.
    """
    names = speaker_names or ["Speaker 1", "Speaker 2"]
    opts = {
        "language_code": language or "en",
        "speaker_labels": not multichannel,
        "speakers_expected": num_speakers,
        "multichannel": multichannel,
        **(extra_opts or {}),
    }

    client = AssemblyAIClient(opts)
    transcript = client.transcribe(audio_path)

    segments: List[Dict[str, Any]] = []
    words: List[Dict[str, Any]] = []
    seen: Dict[str, str] = {}

    utterances = transcript.utterances or []
    for u in utterances:
        raw_key = f"channel_{u.channel}" if multichannel and getattr(u, "channel", None) else u.speaker
        speaker = _speaker_label(raw_key, seen, names)
        segments.append({
            "start": u.start / 1000.0,
            "end": u.end / 1000.0,
            "text": (u.text or "").strip(),
            "speaker": speaker,
        })
        for w in (u.words or []):
            words.append({
                "word": w.text,
                "start": w.start / 1000.0,
                "end": w.end / 1000.0,
                "speaker": speaker,
            })

    result: Dict[str, Any] = {
        "language": getattr(transcript, "language_code", None) or language or "en",
        "segments": segments,
        "words": words,
        "backend": "assemblyai",
        "num_speakers_forced": num_speakers,
    }

    # Optional audio-intelligence extras - only present if requested in extra_opts
    if getattr(transcript, "sentiment_analysis", None):
        result["sentiment"] = [
            {"text": s.text, "sentiment": s.sentiment.value, "confidence": s.confidence,
             "start": s.start / 1000.0, "end": s.end / 1000.0}
            for s in transcript.sentiment_analysis
        ]
    if getattr(transcript, "entities", None):
        result["entities"] = [
            {"text": e.text, "entity_type": e.entity_type.value if hasattr(e.entity_type, "value") else str(e.entity_type)}
            for e in transcript.entities
        ]
    if getattr(transcript, "chapters", None):
        result["chapters"] = [
            {"headline": c.headline, "summary": c.summary, "start": c.start / 1000.0, "end": c.end / 1000.0}
            for c in transcript.chapters
        ]
    if getattr(transcript, "summary", None):
        result["summary"] = transcript.summary
    if getattr(transcript, "iab_categories", None):
        result["topics"] = transcript.iab_categories.summary
    if getattr(transcript, "content_safety", None):
        result["safety_labels"] = transcript.content_safety.summary

    log_with_type(
        "info",
        f"assemblyai_engine: done -> {len(segments)} segments, {len(words)} words, "
        f"speakers={sorted(set(seen.values()))}",
        "PYTHON_ENGINE",
    )
    return result