"""
services/python_deepgram/transcriber.py

Audio transcription + diarization via the Deepgram API (nova-3).

Confirmed session facts baked in:
    - always exactly 2 speakers (tutor + student)
    - language is English
    - tutor teaches -> speaker with most talk time is labelled "Tutor"

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


def _extract_name_from_filename(audio_path: str) -> List[str]:
    """Best-effort extraction of a proper name from the recording filename.

    Recordings in this system follow a naming convention like:
        1064_Neeraj Tanwar_Regular_247412_General Discussion-20260817_092941.mp3
    i.e. underscore-separated fields where the 2nd field (index 1) is
    typically the student's name. This is used as a *dynamic* keyterm
    fallback so callers don't have to manually pass names every time -
    if the filename doesn't match the expected shape, this just returns
    an empty list and keyterm prompting is skipped (no error).
    """
    try:
        base = os.path.splitext(os.path.basename(audio_path))[0]
        parts = base.split("_")
        if len(parts) < 2:
            return []
        candidate = parts[1].strip()
        # Guard against obviously-not-a-name tokens (empty, pure digits,
        # or something that looks like another metadata field).
        if not candidate or candidate.isdigit():
            return []
        return [candidate]
    except Exception:
        return []


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


def transcribe_audio(audio_path: str, keyterms: List[str] | None = None) -> Dict[str, Any]:
    """Send local audio bytes to Deepgram and return engine-shaped JSON.

    keyterms: optional list of proper nouns / names to bias recognition
        toward (e.g. the tutor's and student's names for this session).
        This uses Nova-3's "Keyterm Prompting" feature, which is the
        Nova-3 replacement for the older Nova-2 "keywords" boosting -
        it is NOT just a statistical boost, it contextually biases the
        model toward those exact terms. Pass plain names/terms with no
        weights or ":INTENSIFIER" syntax (that syntax is Nova-2 only and
        is silently ignored/treated as a literal term on Nova-3).
        Without this, names the model hasn't seen much of (e.g. "Abeer")
        can get misheard as a similar-sounding common word/name (e.g.
        "Lee"), especially in short, low-confidence opening greetings.

        If not supplied, this function tries to auto-derive a name from
        the audio filename (see _extract_name_from_filename) so most
        callers get the accuracy boost without any extra wiring.
    """
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

        # Clean/dedupe keyterms; drop anything blank.
        clean_keyterms = [k.strip() for k in (keyterms or []) if k and k.strip()]
        clean_keyterms = list(dict.fromkeys(clean_keyterms))  # de-dupe, preserve order

        # Dynamic fallback: if the caller didn't supply keyterms explicitly,
        # try to derive a name automatically from the filename convention
        # (see _extract_name_from_filename). This means callers get the
        # keyterm-prompting accuracy boost "for free" on correctly-named
        # recordings, without having to look up and pass names manually.
        keyterm_source = "explicit"
        if not clean_keyterms:
            auto_keyterms = _extract_name_from_filename(audio_path)
            if auto_keyterms:
                clean_keyterms = auto_keyterms
                keyterm_source = "auto-from-filename"

        log_with_type(
            "info",
            f"deepgram: sending audio to API (model={DEFAULT_MODEL}, diarize=true, keyterms={clean_keyterms or None}, keyterm_source={keyterm_source})",
            "PYTHON_DEEPGRAM"
        )
        # deepgram-sdk v7: options are passed as keyword arguments and the
        # file payload is raw bytes. `keyterm` (singular param name, list
        # value) is the Nova-3 proper-noun/keyterm-prompting feature.
        transcribe_kwargs = dict(
            request=audio_bytes,
            model=DEFAULT_MODEL,
            smart_format=True,
            diarize=True,
            language="en",
            punctuate=True,
            paragraphs=True,
            utterances=True,
        )
        if clean_keyterms:
            transcribe_kwargs["keyterm"] = clean_keyterms

        response = client.listen.v1.media.transcribe_file(**transcribe_kwargs)
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

        log_with_type(
            "info",
            f"deepgram: word count={len(words)} first_words={words[:20]}",
            "PYTHON_DEEPGRAM"
        )

        log_with_type(
            "info",
            f"deepgram: utterances={alt.get('utterances')}",
            "PYTHON_DEEPGRAM"
        )
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
            # Deepgram's utterances endpoint sometimes returns nothing
            # (see "deepgram: utterances=None" in logs) even when requested,
            # so this path runs more often than expected. Splitting purely on
            # speaker-id change is not enough: Deepgram can tag two genuinely
            # different speaker turns with the *same* id, and without a gap
            # check they get silently concatenated into one merged segment
            # (e.g. a 1s+ silence between "Lee." and "Hi." at call open was
            # being glued into a single "Hello, Lee. Hi." turn). A max-gap
            # threshold forces a turn break whenever there's a real pause,
            # regardless of what speaker id Deepgram assigned.
            MAX_GAP_SECONDS = 0.6
            cur: Dict[str, Any] = None
            for w in words:
                spk = w.get("speaker", 0)
                start = w.get("start")
                gap = (start - cur["end"]) if (cur is not None and start is not None and cur.get("end") is not None) else 0.0
                new_turn = cur is None or cur["_spk"] != spk or (gap is not None and gap > MAX_GAP_SECONDS)
                if new_turn:
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
            log_with_type(
                "info",
                f"deepgram: fallback turn-building used (utterances missing) -> {len(segments)} raw turns, max_gap={MAX_GAP_SECONDS}s",
                "PYTHON_DEEPGRAM"
            )

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