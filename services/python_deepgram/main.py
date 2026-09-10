"""
services/python_deepgram/main.py

CLI: python -m services.python_deepgram.main <audio_or_video_path> [comma,separated,keyterms]

Accepts either an audio or a video recording. Transcribes it via Deepgram
and saves the transcript to storage/transcripts/TRANS_<name>.txt (see
transcriber.transcribe_and_save for the exact naming convention).
"""
import json
import sys

from .transcriber import transcribe_and_save


def main(argv):
    if len(argv) < 2:
        print(json.dumps({"success": False, "error": "usage: python -m services.python_deepgram.main <audio_or_video> [comma,separated,keyterms]"}))
        return 1
    keyterms = None
    if len(argv) >= 3 and argv[2].strip():
        keyterms = [t.strip() for t in argv[2].split(",") if t.strip()]
    out = transcribe_and_save(argv[1], keyterms=keyterms)
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))