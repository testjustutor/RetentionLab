"""
services/python_deepgram/transcriber.py

Audio/video transcription + diarization via the Deepgram API (nova-3).

Confirmed session facts baked in:
    - always exactly 2 speakers (tutor + student)
    - language is English
    - tutor teaches -> speaker with most talk time is labelled "Tutor"

transcribe_audio() is the low-level call: audio bytes in, Deepgram JSON out
    {"success": true, "segments": [...], "words": [...], "language": "en",
     "diarization": [...], "plain_text": "...", "backend": "deepgram-nova-3"}

transcribe_and_save() is the entry point most callers want: accepts EITHER a
video or an audio recording path, extracts audio first if it's a video (via
the same MoviePy-based extractor services/engine uses), transcribes it via
Deepgram, and writes the resulting transcript to storage/transcripts/ using
this project's TRANS_ naming convention (REC_<name>.<ext> -> TRANS_<name>.txt)
so it can be found the same way platform-captions transcripts are (see
PipelineContext._resolve_captions_trans_path).
"""
from __future__ import annotations

import os
import shutil
import tempfile
from typing import Any, Dict, List

from utils.logger_util import log_with_type

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v"}

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

    FIX: the naming convention this originally assumed
    (1064_Neeraj Tanwar_Regular_247412_General Discussion-20260817_092941.mp3)
    is NOT what this project's recorders actually generate. The real,
    confirmed convention (services/audioRecorder.js / services/screenRecorder.js
    - the only two places recording filenames are built, used by all three
    platform bots in services/platforms/ via SocraticBot) is:
        REC_<meetingDbId>_Sess<sessionId>_<YYYY-MM-DD>_<HH-MM>.mp3    (audio)
        SCREEN_<meetingDbId>_Sess<sessionId>_<YYYY-MM-DD>_<HH-MM>.mp4 (video)
    i.e. the 2nd underscore-separated field is always the numeric meeting id,
    never a name - so on real filenames this correctly returns [] (the
    isdigit() guard below already handles that) and keyterm prompting is
    simply skipped. Kept as a best-effort fallback in case a differently
    named recording (e.g. manually placed/imported) does carry a name in
    that position - if the filename doesn't match, this just returns an
    empty list and nothing breaks.
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


# ==========================================================
# VIDEO/AUDIO ENTRY POINT + TRANSCRIPT FILE OUTPUT
# ==========================================================

def _is_video_file(path: str) -> bool:
    """Best-effort video/audio detection by file extension."""
    return os.path.splitext(path)[1].lower() in VIDEO_EXTENSIONS


def _extract_audio_if_needed(input_path: str):
    """If input_path is a video file, extract its audio to a temp mp3 and
    return (audio_path, temp_dir). If it's already an audio file, returns
    (input_path, None) unchanged - nothing to clean up.

    Reuses the same MoviePy-based extraction services/engine/video_convert.py
    uses for the main engine, instead of duplicating ffmpeg/MoviePy handling
    in this isolated module.
    """
    if not _is_video_file(input_path):
        return input_path, None

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"video file not found: {input_path}")

    from services.engine.video_convert import convert_video_to_mp3

    temp_dir = tempfile.mkdtemp(prefix="deepgram_")
    stem = os.path.splitext(os.path.basename(input_path))[0]
    mp3_path = os.path.join(temp_dir, f"{stem}.mp3")

    log_with_type("info", f"deepgram: input is a video file, extracting audio -> {mp3_path}", "PYTHON_DEEPGRAM")

    conversion = convert_video_to_mp3(input_path, mp3_path)
    if not conversion.get("success"):
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError(f"video->audio extraction failed: {conversion.get('error')}")

    return mp3_path, temp_dir


# Three confirmed sources of recording filenames in this project, all
# checked directly:
#   1. services/audioRecorder.js  -> REC_<meetingDbId>_Sess<sessionId>_<YYYY-MM-DD>_<HH-MM>.mp3
#   2. services/screenRecorder.js -> SCREEN_<meetingDbId>_Sess<sessionId>_<YYYY-MM-DD>_<HH-MM>.mp4
#      (both invoked, via SocraticBot, from every platform bot under
#      services/platforms/{google-meet,teams,zoom}/ - those adapter files
#      never build filenames themselves, they just hand off whichever path
#      these two recorders already produced)
#   3. controllers/super_admin/settings/videoProcessingController.js's
#      toMp3Name() -> REC_Meet<meetingId>_Sess<sessionId>_<YYYY>_<MM>_<DD>_<HH-MM>.mp3
#      (the admin video-upload flow - underscored date, "Meet" literal
#      before the id; this is what REC_Meet1_Sess1_2026_08_17_09-29.mp3 is)
#
# All three only ever differ in what comes AFTER the REC_/SCREEN_ prefix -
# never in the prefix itself - so a plain prefix swap (not date/id parsing)
# is correct for all of them. This is also exactly what the project's own
# Node-side transcript-naming code already does, in that same
# videoProcessingController.js's syncAssets():
#     mp3Name.replace(/^REC_/i, 'TRANS_').replace(/\.mp3$/i, '.txt')
# so this stays byte-for-byte consistent with the existing convention rather
# than inventing a new one.
KNOWN_RECORDING_PREFIXES = ("REC_", "SCREEN_")


def _resolve_transcript_output_path(input_path: str) -> str:
    """Build the storage/transcripts/TRANS_<name>.txt path for a recording.

    Convention (matches the rest of this project - see
    PipelineContext._resolve_captions_trans_path / compute_base_id, and
    videoProcessingController.js's syncAssets(), cited above): same filename
    as the recording, its REC_/SCREEN_ prefix swapped for TRANS_, extension
    -> .txt. If the filename doesn't start with a known prefix, TRANS_ is
    simply prepended so this never silently collides with the source
    recording's own filename.
    """
    stem = os.path.splitext(os.path.basename(input_path))[0]

    new_stem = None
    for prefix in KNOWN_RECORDING_PREFIXES:
        if stem.upper().startswith(prefix.upper()):
            new_stem = "TRANS_" + stem[len(prefix):]
            break
    if new_stem is None:
        new_stem = f"TRANS_{stem}"

    transcripts_dir = os.path.join(PROJECT_ROOT, "storage", "transcripts")
    os.makedirs(transcripts_dir, exist_ok=True)
    return os.path.join(transcripts_dir, f"{new_stem}.txt")


def _build_transcript_text(segments: List[Dict[str, Any]]) -> str:
    """Render Deepgram's labeled (Tutor/Student) segments as a plain-text
    transcript, one turn per line: "[start - end] Speaker: text" - matches
    the timestamped-turn formatting convention used elsewhere in this
    project (services/engine/services/transcript_builder.py)."""
    lines = []
    for seg in segments:
        start = seg.get("start")
        end = seg.get("end")
        start_s = f"{float(start):.2f}" if start is not None else "?"
        end_s = f"{float(end):.2f}" if end is not None else "?"
        speaker = seg.get("speaker") or "Speaker"
        text = (seg.get("text") or "").strip()
        lines.append(f"[{start_s} - {end_s}] {speaker}: {text}")
    return "\n".join(lines)


def transcribe_and_save(input_path: str, keyterms: List[str] | None = None) -> Dict[str, Any]:
    """Main entry point: accepts a recording path - video OR audio, whichever
    was generated - transcribes it via Deepgram, and saves the transcript to
    storage/transcripts/TRANS_<name>.txt (REC_ -> TRANS_ prefix swap, .txt
    extension), so it's discoverable the same way platform-captions
    transcripts already are.

    Returns the same shape as transcribe_audio(), plus "transcript_path"
    (the saved file's path, or None if transcription failed).
    """
    # Derive keyterms from the ORIGINAL filename (e.g. REC_1064_Neeraj...)
    # before any video->audio conversion - a temp extracted-audio filename
    # wouldn't match the naming convention _extract_name_from_filename
    # expects, so auto-keyterm derivation must happen on the source path.
    if not keyterms:
        keyterms = _extract_name_from_filename(input_path)

    try:
        audio_path, temp_dir = _extract_audio_if_needed(input_path)
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        log_with_type("error", f"deepgram: {error}", "PYTHON_DEEPGRAM")
        return {
            "success": False, "audio_file": input_path, "language": "en",
            "backend": f"deepgram-{DEFAULT_MODEL}", "segments": [], "words": [],
            "diarization": [], "plain_text": "", "transcript_path": None,
            "error": error,
        }

    try:
        result = transcribe_audio(audio_path, keyterms=keyterms)
        result["audio_file"] = input_path  # report the ORIGINAL path, not the temp mp3
        result["transcript_path"] = None

        if result.get("success"):
            transcript_text = _build_transcript_text(result.get("segments") or [])
            output_path = _resolve_transcript_output_path(input_path)
            with open(output_path, "w", encoding="utf-8") as fh:
                fh.write(transcript_text)
            result["transcript_path"] = output_path
            log_with_type("info", f"deepgram: transcript saved -> {output_path}", "PYTHON_DEEPGRAM")

        return result
    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)