"""
services/python_deepgram/transcriber.py

Audio transcription + diarization via the Deepgram API (nova-3).

Confirmed session facts baked in:
    - always exactly 2 speakers (tutor + student)
    - language is English
    - tutor teaches -> speaker with most talk time is labelled "Tutor"

Output shape matches services/python_engine so either engine can be used
interchangeably by the Node controller:
    {"success": true, "segments": [...], "words": [...], "language": "en",
     "diarization": [...], "plain_text": "...", "backend": "deepgram-nova-3"}
"""
from __future__ import annotations

import os
from typing import Any, Dict, List

from utils.logger_util import log_with_type

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

# Standalone engine: load its own credentials from the project .env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
except Exception:
    pass

DEFAULT_MODEL = "nova-3"
TUTOR_STUDENT = ["Tutor", "Student"]


def _get_client():
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPGRAM_API_KEY not configured in environment")
    from deepgram import DeepgramClient
    return DeepgramClient(api_key=api_key)


def _apply_role_labels(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Most total talk time = Tutor (they teach); other(s) = Student."""
    talk = {}
    for s in segments:
        spk = s.get("speaker")
        talk[spk] = talk.get(spk, 0) + max(0.0, float(s.get("end") or 0) - float(s.get("start") or 0))
    if not talk:
        return segments
    ordered = sorted(talk.keys(), key=lambda k: talk[k], reverse=True)
    mapping = {}
    for i, spk in enumerate(ordered):
        mapping[spk] = TUTOR_STUDENT[i] if i < len(TUTOR_STUDENT) else f"SPEAKER_{i:02d}"
    log_with_type("info", f"deepgram: role mapping by talk-time -> {mapping} ({ {k: round(v,1) for k,v in talk.items()} })", "PYTHON_DEEPGRAM")
    for s in segments:
        s["speaker"] = mapping.get(s.get("speaker"), s.get("speaker"))
    return segments


def transcribe_audio(audio_path: str) -> Dict[str, Any]:
    """Send local audio bytes to Deepgram and return engine-shaped JSON."""
    result: Dict[str, Any] = {
        "success": False, "audio_file": audio_path, "language": "en",
        "backend": f"deepgram-{DEFAULT_MODEL}", "segments": [], "words": [],
        "diarization": [], "plain_text": "", "error": None,
    }
    if not audio_path or not os.path.exists(audio_path):
        result["error"] = f"audio file not found: {audio_path}"
        log_with_type("error", f"deepgram: {result['error']}", "PYTHON_DEEPGRAM")
        return result

    try:
        from deepgram import DeepgramClient  # noqa: F401 (validate install)

        client = _get_client()
        with open(audio_path, "rb") as fh:
            audio_bytes = fh.read()

        log_with_type("info", f"deepgram: sending audio to API (model={DEFAULT_MODEL}, diarize=true)", "PYTHON_DEEPGRAM")
        # deepgram-sdk v7: options are passed as keyword arguments and the
        # file payload is raw bytes.
        response = client.listen.v1.media.transcribe_file(
            request=audio_bytes,
            model=DEFAULT_MODEL,
            smart_format=True,
            diarize=True,
            language="en",
            punctuate=True,
            paragraphs=True,
            utterances=True,
        )
        if hasattr(response, "model_dump"):
            data = response.model_dump()
        elif hasattr(response, "to_dict"):
            data = response.to_dict()
        else:
            raise RuntimeError("Unsupported Deepgram response type")

        alt = (data.get("results", {})
                    .get("channels", [{}])[0]
                    .get("alternatives", [{}])[0])

        words = alt.get("words", []) or []

        # Preferred: ready-made speaker turns from the API.
        api_utterances = alt.get("utterances") or []
        segments: List[Dict[str, Any]] = []
        if api_utterances:
            for u in api_utterances:
                spk = u.get("speaker", 0)
                segments.append({
                    "speaker": f"SPEAKER_{int(spk):02d}",
                    "start": u.get("start"),
                    "end": u.get("end"),
                    "text": (u.get("transcript") or "").strip(),
                })
        else:
            # Fallback: group per-word speakers into turns.
            cur: Dict[str, Any] = None
            for w in words:
                spk = w.get("speaker", 0)
                if cur is None or cur["_spk"] != spk:
                    if cur is not None:
                        segments.append(cur)
                    cur = {"_spk": spk, "speaker": f"SPEAKER_{int(spk):02d}", "start": w.get("start"),
                           "end": w.get("end"), "text": w.get("punctuated_word") or w.get("word") or ""}
                else:
                    cur["end"] = w.get("end")
                    cur["text"] = f"{cur['text']} {w.get('punctuated_word') or w.get('word')}".strip()
            if cur is not None:
                segments.append(cur)
            for s in segments:
                s.pop("_spk", None)

        segments = _apply_role_labels(segments)
        diarization = [{"start": s["start"], "end": s["end"], "speaker": s["speaker"]} for s in segments]

        result.update({
            "success": True,
            "duration": data.get("metadata", {}).get("duration"),
            "segments": segments,
            "diarization": diarization,
            "plain_text": alt.get("transcript", ""),
            # raw word stream kept for word-level consumers
            "words": [
                {"word": w.get("punctuated_word") or w.get("word"),
                 "start": w.get("start"), "end": w.get("end"),
                 "confidence": w.get("confidence"), "speaker": f"SPEAKER_{int(w.get('speaker', 0)):02d}"}
                for w in words
            ],
        })
        n_spk = len({s["speaker"] for s in segments})
        log_with_type("info", f"deepgram: done -> {len(segments)} turns, speakers={n_spk}, duration={result['duration']}s", "PYTHON_DEEPGRAM")
        return result
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        log_with_type("error", f"deepgram transcription failed -> {result['error']}", "PYTHON_DEEPGRAM")
        return result
