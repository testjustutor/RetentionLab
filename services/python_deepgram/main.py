"""
services/python_deepgram/main.py

CLI: python -m services.python_deepgram.main <audio_or_video_path> [comma,separated,keyterms]
                                              [--meeting-id ID] [--session-id ID]

Accepts either an audio or a video recording. Transcribes it via Deepgram
and saves the transcript to storage/transcripts/TRANS_<name>.txt (see
transcriber.transcribe_and_save for the exact naming convention).

--meeting-id/--session-id: pass these when the caller (runner.js) already
knows which meeting/session this recording belongs to, so the teacher name
(read from the filename) and student name (detected from the transcript)
get written into the shared `participants` table - see
transcriber.transcribe_and_save and participants_repo.save_participants.
Omit them and transcribe_and_save() falls back to auto-deriving both from
a REC_<meetingId>_Sess<sessionId>_... filename when the recording follows
that convention; otherwise the names are still returned in the JSON output,
just not persisted to the DB.
"""
import argparse
import json
import sys

from .transcriber import transcribe_and_save


def _parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="python -m services.python_deepgram.main",
        description="Transcribe+diarize a recording via Deepgram and save the transcript.",
    )
    parser.add_argument("audio_or_video", help="Path to the audio or video recording")
    parser.add_argument(
        "keyterms", nargs="?", default=None,
        help="Optional comma-separated proper nouns/names to bias Deepgram's recognition "
             "toward (Nova-3 keyterm prompting). Positional, kept for backward compatibility "
             "with existing callers.",
    )
    parser.add_argument(
        "--meeting-id", dest="meeting_id", type=int, default=None,
        help="Meeting DB id - enables saving the detected teacher/student names into the "
             "participants table. Auto-derived from REC_/SCREEN_ filenames when omitted.",
    )
    parser.add_argument(
        "--session-id", dest="session_id", type=int, default=None,
        help="Meeting session DB id - see --meeting-id.",
    )
    return parser.parse_args(argv)


def main(argv):
    # argv is the full sys.argv (script name at [0]), matching this
    # project's existing convention for this entry point.
    try:
        args = _parse_args(argv[1:])
    except SystemExit:
        # argparse already wrote usage/error detail to stderr; still honor
        # the JSON-on-stdout contract callers (runner.js) parse even on the
        # failure path.
        print(json.dumps({
            "success": False,
            "error": "usage: python -m services.python_deepgram.main <audio_or_video> "
                     "[comma,separated,keyterms] [--meeting-id ID] [--session-id ID]",
        }))
        return 1

    keyterms = None
    if args.keyterms and args.keyterms.strip():
        keyterms = [t.strip() for t in args.keyterms.split(",") if t.strip()]

    out = transcribe_and_save(
        args.audio_or_video,
        keyterms=keyterms,
        meeting_id=args.meeting_id,
        session_id=args.session_id,
    )
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
