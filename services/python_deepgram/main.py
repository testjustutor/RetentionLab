"""
services/python_deepgram/main.py

CLI: python -m services.python_deepgram.main <audio_path>
Prints engine-shaped JSON (same shape as services/python_engine).
"""
import json
import sys

from .transcriber import transcribe_audio


def main(argv):
    if len(argv) < 2:
        print(json.dumps({"success": False, "error": "usage: python -m services.python_deepgram.main <audio>"}))
        return 1
    out = transcribe_audio(argv[1])
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
