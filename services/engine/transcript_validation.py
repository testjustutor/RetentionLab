# services/engine/transcript_validation.py

"""
Pre-audit transcript validation.

Detects two cases where sending a transcript to the AI audit would waste the
LLM call and/or produce a meaningless result:

  1. "empty_transcript" - the transcript has little or no actual spoken
     content (a completely silent recording, a bot that joined and left with
     nobody talking, etc).
  2. "single_speaker" - only one distinct speaker was captured, so there is
     no real tutor/student conversation to audit.

Called from services/engine/task/transcription_task.py right after
context.labeled_transcript is set, BEFORE the audit task runs.

IMPORTANT: the two checks look at different inputs on purpose.
  - meaningful_word_count() runs against the PLAIN Whisper transcript
    (context.labeled_transcript) - that is exactly what the AI audit reads,
    so "is there enough content to audit" must be judged on that same text.
  - detect_speaker_count() runs against the raw platform CAPTIONS transcript
    (the TRANS_*.txt file at context.captions_trans_path), because the live
    Whisper path (transcript_builder.py::build_plain_text) never attaches
    speaker labels at all - only the captions file the meeting bot wrote
    (Teams/Zoom/Google Meet) carries real speaker names to count.
"""

import os
import re

from utils.logger_util import log_with_type


# Minimum number of "meaningful" words the plain transcript must contain
# before it's considered worth sending to the AI audit. Configurable via env
# so ops can tune it without a code change.
MIN_MEANINGFUL_WORDS = int(os.environ.get("TRANSCRIPT_MIN_MEANINGFUL_WORDS", "10"))

# Generic caption-line pattern: matches ANY "[something] Name: text" line,
# regardless of whether the platform stamps a single timestamp
# (Teams/Zoom: "[4:02:24 PM] Name: text") or a time RANGE (Google Meet /
# Deepgram: "[19:12:52 - 19:12:52] Name: text"), and regardless of raw
# diarization labels ("Speaker 1", "SPEAKER_00", etc). Deliberately NOT
# hardcoded per-platform so a future caption format still gets picked up as
# long as it keeps the "[...] Name:" shape.
CAPTION_LINE_RE = re.compile(r"^\s*\[[^\]\n]*\]\s*([^:\n]+?)\s*:", re.MULTILINE)

# Boilerplate banner/header/footer lines written by captionMonitor.js into
# every TRANS_*.txt file (====== dividers, "<PLATFORM> MEETING TRANSCRIPT"
# title, Meeting/Session ID, Date, "TRANSCRIPT ENDED" footer). Stripped
# before word-counting so a completely silent meeting (header/footer only,
# no captions) isn't miscounted as having real content.
_BOILERPLATE_LINE_RE = re.compile(
    r"^\s*(=+|[A-Z][A-Z\- ]*MEETING TRANSCRIPT|Meeting ID\s*:|Session ID\s*:|Date\s*:|TRANSCRIPT ENDED\s*:).*$",
    re.MULTILINE,
)


def strip_boilerplate(text):
    """Remove TRANS_*.txt banner/header/footer noise, returning just the
    remaining non-empty lines (captions or plain transcript lines)."""
    if not text:
        return ""
    cleaned = _BOILERPLATE_LINE_RE.sub("", text)
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    return "\n".join(lines)


def meaningful_word_count(text):
    """Word count of `text` after boilerplate banner/header/footer lines are
    stripped. Used against the plain Whisper transcript to decide whether
    there is enough real content to bother auditing."""
    cleaned = strip_boilerplate(text)
    if not cleaned:
        return 0
    return len(cleaned.split())


def detect_speaker_count(captions_text):
    """
    Best-effort count of distinct speakers in a platform captions transcript
    (TRANS_*.txt content) - NOT the plain Whisper transcript, which carries
    no speaker labels at all in the live pipeline.

    Uses a single generic "[...] Name:" line pattern rather than one
    hardcoded regex per platform, so it transparently covers every real
    format in this codebase (Teams/Zoom single-timestamp, Google Meet/
    Deepgram time-range, and the unused diarization build() float-second
    format) plus any future caption format that keeps the same shape.

    Returns 0 when no captions text/lines are available - callers should
    treat that as "unknown" (skip the single-speaker check) rather than
    assume single-speaker, since a missing captions file just means no live
    captions were ever captured for this session (e.g. admin-uploaded video).
    """
    if not captions_text:
        return 0

    names = set()
    for match in CAPTION_LINE_RE.finditer(captions_text):
        name = match.group(1).strip()
        if name:
            names.add(name.lower())

    return len(names)


def validate_transcript(plain_transcript, captions_text=None, talk_ratio=None):
    """
    Decide whether a transcript is worth sending to the AI audit.

    Args:
        plain_transcript: the Whisper plain-text transcript
            (context.labeled_transcript) - exactly what the AI audit reads.
        captions_text: raw platform captions transcript content (read from
            context.captions_trans_path by the caller), used ONLY to count
            distinct speakers when available. May be None/empty (e.g. an
            admin-uploaded recording with no live captions) - in that case
            the single-speaker check is skipped rather than guessed at.
        talk_ratio: optional {speaker: pct} dict (an already-computed
            diarization talk ratio). Used as a secondary signal only: if it
            has 2+ entries, that alone disproves "single speaker" even when
            no captions_text was available.

    Returns:
        {"valid": True} - safe to continue to the AI audit.
        {"valid": False, "reason": "empty_transcript" | "single_speaker",
         "message": <user-facing friendly text>}
    """
    word_count = meaningful_word_count(plain_transcript)

    if word_count < MIN_MEANINGFUL_WORDS:
        log_with_type(
            "info",
            f"Engine(transcript_validation) : Empty/near-empty transcript detected "
            f"words={word_count} threshold={MIN_MEANINGFUL_WORDS}",
            "VALIDATION",
        )
        return {
            "valid": False,
            "reason": "empty_transcript",
            "message": (
                "No meaningful conversation was detected in this recording, "
                "so the AI audit was skipped. This usually happens when the "
                "meeting had little or no spoken content."
            ),
        }

    speaker_count = detect_speaker_count(captions_text)

    if speaker_count == 0 and isinstance(talk_ratio, dict):
        speaker_count = len(talk_ratio)

    if speaker_count == 1:
        log_with_type(
            "info",
            "Engine(transcript_validation) : Single-speaker-only transcript detected - skipping AI audit",
            "VALIDATION",
        )
        return {
            "valid": False,
            "reason": "single_speaker",
            "message": (
                "Only one speaker was detected in this recording, so the AI "
                "audit was skipped. A meaningful audit requires a two-way "
                "conversation between the tutor and the student."
            ),
        }

    return {"valid": True}
