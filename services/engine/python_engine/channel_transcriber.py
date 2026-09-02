"""
services/engine/python_engine/channel_transcriber.py

STEP 5: per-participant channel transcription.

When a recording exposes real per-mic audio (e.g. stereo L/R == tutor/student),
each channel is transcribed INDEPENDENTLY with Whisper and the results are
merged by timestamp. Diarization is skipped entirely - the channel IS the
speaker identity, which is more accurate than any diarization model (and is
how Teams generates captions).
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from utils.logger_util import log_with_type


def _transcribe_one(path: str, model_size: str, language, speaker: str,
                    progress_cb=None) -> Dict[str, Any]:
    """Transcribe one mono channel; every segment/word is labelled `speaker`."""
    from .whisper_engine import WhisperEngine

    def cb(pct):
        if progress_cb:
            progress_cb(pct)

    engine = WhisperEngine(model_size=model_size, device="auto", language=language)
    result = engine.transcribe(path)

    segments = [
        {**s, "speaker": speaker}
        for s in result.get("segments", [])
    ]
    # NOTE: this used to fabricate a single word entry per segment with
    # word="" (a placeholder, not real word-level data). WhisperEngine now
    # requests word_timestamps=True, so real per-word timing is available on
    # each segment's "words" list — use that instead.
    words = [
        {
            "word": (w.get("word") or "").strip(),
            "start": float(w.get("start") or s.get("start", 0)),
            "end": float(w.get("end") or s.get("end", 0)),
            "speaker": speaker,
        }
        for s in result.get("segments", [])
        for w in (s.get("words") or [])
        if (w.get("word") or "").strip()
    ]
    return {"segments": segments, "words": words, "language": result.get("language")}


def merge_by_timestamp(channel_results: List[Dict[str, Any]],
                       gap_seconds: float = 1.0) -> Dict[str, Any]:
    """Merge multiple channel transcripts into one timeline, sorted by start
    time, merging consecutive same-speaker lines that are close together."""
    all_segs: List[Dict[str, Any]] = []
    for res in channel_results:
        all_segs.extend(res.get("segments", []))
    all_segs.sort(key=lambda s: float(s.get("start", 0)))

    merged: List[Dict[str, Any]] = []
    for seg in all_segs:
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        if merged:
            prev = merged[-1]
            same_speaker = prev.get("speaker") == seg.get("speaker")
            close = abs(float(seg.get("start", 0)) - float(prev.get("end", 0))) <= gap_seconds
            if same_speaker and close:
                prev["text"] = f"{prev['text']} {text}".strip()
                prev["end"] = max(float(prev.get("end", 0)), float(seg.get("end", 0)))
                continue
        merged.append(dict(seg))

    language = next((r.get("language") for r in channel_results if r.get("language")), "en")
    return {"segments": merged, "language": language}


def transcribe_channels(channel_files: List[str], model_size: str = "small",
                        language=None, progress_cb=None,
                        speaker_names=None) -> Dict[str, Any]:
    """Transcribe each channel independently and merge. Returns
    {segments, words, language} with speakers assigned per channel.

    Default: channel 1 = Speaker 1, channel 2 = Speaker 2."""
    if len(channel_files) != 2:
        raise ValueError("Expected exactly 2 channel files (Speaker 1 + Speaker 2)")
    names = list(speaker_names or ["Speaker 1", "Speaker 2"])

    log_with_type("info", f"channel_transcriber: transcribing {len(channel_files)} channels independently (model={model_size})", "PYTHON_ENGINE")

    results = []
    for idx, ch_path in enumerate(channel_files):
        speaker = names[idx] if idx < len(names) else f"SPEAKER_{idx:02d}"
        log_with_type("info", f"channel_transcriber: transcribing channel {idx + 1}/{len(channel_files)} as {speaker}", "PYTHON_ENGINE")
        results.append(_transcribe_one(ch_path, model_size, language, speaker, progress_cb))

    merged = merge_by_timestamp(results)
    words = []
    for res in results:
        words.extend(res.get("words", []))
    words.sort(key=lambda w: float(w.get("start", 0)))

    return {
        "segments": merged["segments"],
        "words": words,
        "language": merged.get("language") or "en",
    }