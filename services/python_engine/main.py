"""
services/python_engine/main.py

Standalone CLI entry for the isolated Whisper + Resemblyzer engine.

Usage:
    python -m services.python_engine.main <audio_path> [ai_settings_json] [--output out.json]

Prints a single UTF-8 JSON object (matching the Node bridge contract) so the
output can be captured by spawn/exec from Node or directly on the CLI. Writes
an optional copy of the diarization to --output_dir if provided.

This module is intentionally independent from services.engine.
"""
from __future__ import annotations

import argparse
import json
import os
import sys


def _reconfigure_stdio() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def _json_default(o):
    """json.dumps default: make non-JSON-serializable types (e.g. Decimal)
    serializable so a DB-sourced numeric can never crash the CLI output."""
    from decimal import Decimal
    if isinstance(o, Decimal):
        return float(o)
    return str(o)


def main(argv=None) -> int:
    _reconfigure_stdio()

    parser = argparse.ArgumentParser(description="Whisper + Resemblyzer diarization (isolated engine)")
    parser.add_argument("input_file", help="Path or /storage/... handle to the audio file")
    parser.add_argument("ai_settings_json", nargs="?", default="", help="Optional JSON settings blob")
    parser.add_argument("--model", default="large-v3", help="Whisper model size (tiny/base/small/medium/large)")
    parser.add_argument("--output_dir", default=None, help="Optional directory to write the JSON result to")
    args = parser.parse_args(argv)

    from .pipeline import run_pipeline

    try:
        result = run_pipeline(
            args.input_file,
            ai_settings_json=args.ai_settings_json or None,
            model_size=args.model,
        )
    except Exception as exc:  # pragma: no cover - safety net
        import traceback
        from utils.logger_util import log_with_type
        log_with_type(
            "error",
            f"python_engine: FATAL pipeline crashed -> {type(exc).__name__}: {exc} "
            f"| trace: {traceback.format_exc(limit=3)}",
            "PYTHON_ENGINE",
        )
        result = {"success": False, "engine": "python_engine", "error": str(exc)}

    # DATA CHANNEL (not a log): single-line JSON on stdout is the Node bridge
    # contract - this is the ONLY permitted raw stdout write in this engine.
    print(json.dumps(result, ensure_ascii=False, default=_json_default))

    # Optionally persist a copy (diarization JSON) for inspection/tests.
    if args.output_dir and result.get("success"):
        try:
            os.makedirs(args.output_dir, exist_ok=True)
            audio_base = os.path.splitext(os.path.basename(result.get("audio_file", "audio")))[0]
            out_path = os.path.join(args.output_dir, f"{audio_base}_diar.json")
            with open(out_path, "w", encoding="utf-8") as fh:
                json.dump(result, fh, ensure_ascii=False, indent=2, default=_json_default)
        except Exception:
            pass

    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())