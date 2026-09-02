"""
services/engine/python_engine/storage_output.py

Writes the final diarization/transcript result to
    <project>/storage/video_diarization/

Produces a human-readable, speaker-labelled, line-by-line transcript:
    [HH:MM:SS - HH:MM:SS] SPEAKER_00: spoken text

The output dir is created if missing, and one file is written per audio file
named after the audio (e.g. REC_xxx.mp3 -> REC_xxx.diarization.txt).
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

from utils.logger_util import log_with_type


def default_output_dir() -> str:
    project_root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
    return os.path.join(project_root, "storage", "video_diarization")


def _format_ts(seconds: Optional[float]) -> str:
    """Convert seconds -> H:MM:SS (or '--:--:--' when missing)."""
    if seconds is None:
        return "--:--:--"
    s = max(0, int(round(seconds)))
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{sec:02d}"


def _merge_text_lines(segments: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    """Merge consecutive segments that share the SAME speaker into one line
    (so the transcript reads naturally line-by-line rather than fragment-by-
    fragment). Returns [{start,end,speaker,text}]."""
    lines: list[Dict[str, Any]] = []
    for seg in segments:
        speaker = seg.get("speaker") or "SPEAKER_00"
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        if lines and lines[-1]["speaker"] == speaker:
            lines[-1]["text"] += " " + text
            lines[-1]["end"] = seg.get("end", lines[-1].get("end"))
        else:
            lines.append({
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "speaker": speaker,
                "text": text,
            })
    return lines


def build_transcript_text(segments: list[Dict[str, Any]]) -> str:
    """Build the plain, line-by-line speaker-labelled transcript string."""
    merged = _merge_text_lines(segments or [])
    out: list[str] = []
    for line in merged:
        ts = f"[{_format_ts(line['start'])} - {_format_ts(line['end'])}]"
        out.append(f"{ts} {line['speaker']}: {line['text']}")
    return "\n".join(out)


def save_diarization_result(
    result: Dict[str, Any],
    output_dir: Optional[str] = None,
) -> Optional[str]:
    """Write the diarization result file. Returns the written path (or None)."""
    if not result or result.get("success") is not True:
        return None

    audio_file = result.get("audio_file") or "audio"
    base = os.path.splitext(os.path.basename(audio_file))[0]
    out_dir = output_dir or default_output_dir()

    try:
        os.makedirs(out_dir, exist_ok=True)
        txt_path = os.path.join(out_dir, f"{base}.diarization.txt")
        # line-by-line speaker-labelled transcript
        transcript = build_transcript_text(result.get("segments", []))
        with open(txt_path, "w", encoding="utf-8") as fh:
            fh.write(f"# Diarization transcript\n")
            fh.write(f"# Audio        : {audio_file}\n")
            fh.write(f"# Language     : {result.get('language', '')}\n")
            fh.write(f"# Whisper      : {result.get('whisper_backend', '')}\n")
            fh.write(f"# Diarization  : {'available' if result.get('diarization_available') else 'unavailable (SPEAKER_00)'}\n")
            fh.write("#\n")
            fh.write(transcript)
            fh.write("\n")

        # Also write the full machine-readable JSON beside it
        import json
        json_path = os.path.join(out_dir, f"{base}.diarization.json")
        with open(json_path, "w", encoding="utf-8") as fh:
            json.dump(result, fh, ensure_ascii=False, indent=2)

        return txt_path
    except Exception as exc:  # never break the pipeline on a write error
        log_with_type(
            "error",
            f"python_engine/storage_output: failed to write result -> {type(exc).__name__}: {exc}",
            "PYTHON_ENGINE",
        )
        return None


def save_plain_transcript(
    result: Dict[str, Any],
    output_dir: Optional[str] = None,
) -> Optional[str]:
    """Write the audio-only plain transcript to <base>.transcript.txt next to
    the diarization outputs. Contains EXACTLY result["plain_text"] - no speaker
    labels, no timestamps, no headers. Never raises; returns the path or None.
    """
    if not result or not (result.get("plain_text") or "").strip():
        return None

    audio_file = result.get("audio_file") or "audio"
    base = os.path.splitext(os.path.basename(audio_file))[0]
    out_dir = output_dir or default_output_dir()

    try:
        os.makedirs(out_dir, exist_ok=True)
        txt_path = os.path.join(out_dir, f"{base}.transcript.txt")
        with open(txt_path, "w", encoding="utf-8") as fh:
            fh.write(result["plain_text"])
        return txt_path
    except Exception as exc:  # never break the pipeline on a write error
        log_with_type(
            "error",
            f"python_engine/storage_output: failed to write plain transcript -> {type(exc).__name__}: {exc}",
            "PYTHON_ENGINE",
        )
        return None