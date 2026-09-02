"""
services/engine/main.py

Standalone CLI entry, mirrors services/engine/python_engine/main.py's contract
so runner.js / other outer pages can call it the same way.

Usage:
    python -m services.engine.main <audio_path> [opts_json] [--output out.json]
"""
from __future__ import annotations
import argparse
import json
import os
import sys


def _reconfigure_stdio():
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass


def main(argv=None) -> int:
    _reconfigure_stdio()
    parser = argparse.ArgumentParser(description="AssemblyAI transcription + diarization (isolated engine)")
    parser.add_argument("input_file", help="Path or URL to the audio file")
    parser.add_argument("opts_json", nargs="?", default="", help="Optional JSON options blob")
    parser.add_argument("--output_dir", default=None)
    args = parser.parse_args(argv)

    from .transcriber import transcribe_and_diarize

    opts = {}
    if args.opts_json:
        try:
            opts = json.loads(args.opts_json)
        except Exception:
            opts = {}

    try:
        result = transcribe_and_diarize(
            args.input_file,
            num_speakers=int(opts.get("num_speakers", 2)),
            language=opts.get("language"),
            multichannel=bool(opts.get("multichannel", False)),
            speaker_names=opts.get("speaker_names"),
            extra_opts=opts.get("extra_opts"),
        )
        result["success"] = True
    except Exception as exc:
        result = {"success": False, "error": str(exc)}

    print(json.dumps(result, ensure_ascii=False))

    if args.output_dir and result.get("success"):
        try:
            os.makedirs(args.output_dir, exist_ok=True)
            base = os.path.splitext(os.path.basename(args.input_file))[0]
            out_path = os.path.join(args.output_dir, f"{base}_assemblyai.json")
            with open(out_path, "w", encoding="utf-8") as fh:
                json.dump(result, fh, ensure_ascii=False, indent=2)
        except Exception:
            pass

    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))