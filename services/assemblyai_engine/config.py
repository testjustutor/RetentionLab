"""
services/assemblyai_engine/config.py

Central place to configure the AssemblyAI SDK. Reads ASSEMBLYAI_API_KEY from
the environment (root .env). Isolated from services/python_engine and
services/engine - no shared imports.
"""
import os
from typing import Any, Dict, Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


def init_sdk():
    """Call once before using any aai.* class. Safe to call repeatedly."""
    import assemblyai as aai
    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    if not api_key:
        raise RuntimeError("ASSEMBLYAI_API_KEY not configured")
    aai.settings.api_key = api_key
    base_url = os.getenv("ASSEMBLYAI_BASE_URL")
    if base_url:
        aai.settings.base_url = base_url
    return aai


def build_transcription_config(aai, opts: Optional[Dict[str, Any]] = None):
    """Build a TranscriptionConfig from a plain dict so callers (Node bridge,
    CLI, other Python modules) don't need to import assemblyai themselves.

    Supported opts (all optional):
        language_code: str (default "en")
        speaker_labels: bool
        speakers_expected: int
        multichannel: bool
        sentiment_analysis: bool
        entity_detection: bool
        auto_chapters: bool
        summarization: bool
        iab_categories: bool          # topic detection
        content_safety: bool           # content moderation guardrail
        redact_pii: bool
        redact_pii_policies: list[str] # e.g. ["person_name", "phone_number"]
        filter_profanity: bool
        word_boost: list[str]          # domain keyterms
        speech_models: list[str]
    """
    opts = opts or {}
    kwargs: Dict[str, Any] = {
        "language_code": opts.get("language_code", "en"),
        "speaker_labels": bool(opts.get("speaker_labels", False)),
        "multichannel": bool(opts.get("multichannel", False)),
        "sentiment_analysis": bool(opts.get("sentiment_analysis", False)),
        "entity_detection": bool(opts.get("entity_detection", False)),
        "auto_chapters": bool(opts.get("auto_chapters", False)),
        "summarization": bool(opts.get("summarization", False)),
        "iab_categories": bool(opts.get("iab_categories", False)),
        "content_safety": bool(opts.get("content_safety", False)),
        "filter_profanity": bool(opts.get("filter_profanity", False)),
    }
    if opts.get("speakers_expected") and not opts.get("multichannel"):
        kwargs["speakers_expected"] = int(opts["speakers_expected"])
    if opts.get("word_boost"):
        kwargs["word_boost"] = list(opts["word_boost"])
    if opts.get("speech_models"):
        kwargs["speech_models"] = list(opts["speech_models"])
    if opts.get("redact_pii"):
        kwargs["redact_pii"] = True
        kwargs["redact_pii_policies"] = opts.get("redact_pii_policies") or ["person_name"]

    # multichannel and speaker_labels are mutually exclusive per the API
    if kwargs["multichannel"]:
        kwargs["speaker_labels"] = False
        kwargs.pop("speakers_expected", None)

    return aai.TranscriptionConfig(**kwargs)