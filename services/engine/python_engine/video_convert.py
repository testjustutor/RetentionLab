"""
services/engine/python_engine/video_convert.py

Video -> MP3 audio extraction using MoviePy (VideoFileClip).

Used by the Node controller's Convert step instead of calling ffmpeg
directly from Node - all media work lives inside python_engine.

CLI:
    python -m services.python_engine.video_convert <video_path> <mp3_path>

Prints a JSON result: {"success": true, "audio_file": "...", "duration": ...}
"""
from __future__ import annotations

import json
import os
import sys

from utils.logger_util import log_with_type


def convert_video_to_mp3(video_path: str, mp3_path: str) -> dict:
    """Extract audio from `video_path` into `mp3_path` using MoviePy.

    Returns {"success": bool, "audio_file": str, "duration": float|None,
             "error": str|None}.
    """
    result = {"success": False, "audio_file": mp3_path, "duration": None, "error": None}
    if not video_path or not os.path.exists(video_path):
        result["error"] = f"video file not found: {video_path}"
        log_with_type("error", f"video_convert: {result['error']}", "PYTHON_ENGINE")
        return result

    os.makedirs(os.path.dirname(os.path.abspath(mp3_path)) or ".", exist_ok=True)

    log_with_type("info", f"video_convert: extracting audio via MoviePy -> {os.path.basename(mp3_path)}", "PYTHON_ENGINE")
    clip = None
    try:
        # MoviePy 2.x moved everything to `moviepy`; 1.x used moviepy.editor.
        try:
            from moviepy import VideoFileClip  # MoviePy >= 2.0
        except ImportError:
            from moviepy.editor import VideoFileClip  # MoviePy 1.x

        clip = VideoFileClip(video_path)
        result["duration"] = round(float(clip.duration or 0), 2)
        # Lightweight mono MP3 - transcription does not need stereo/44.1k.
        clip.audio.write_audiofile(
            mp3_path,
            fps=16000,
            nbytes=2,
            codec="libmp3lame",
            bitrate="96k",
            ffmpeg_params=["-ac", "1"],
            logger=None,  # keep stdout clean for JSON parsing by Node
        )
        if not os.path.exists(mp3_path) or os.path.getsize(mp3_path) == 0:
            result["error"] = "MoviePy did not create the MP3 file"
            log_with_type("error", f"video_convert: {result['error']}", "PYTHON_ENGINE")
            return result

        result["success"] = True
        log_with_type("info",
                      f"video_convert: done -> {os.path.basename(mp3_path)} "
                      f"({os.path.getsize(mp3_path) // 1024} KB, duration={result['duration']}s)",
                      "PYTHON_ENGINE")
        return result
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        log_with_type("error", f"video_convert failed -> {result['error']}", "PYTHON_ENGINE")
        return result
    finally:
        try:
            if clip is not None:
                clip.close()
        except Exception:
            pass


def main(argv):
    if len(argv) < 3:
        print(json.dumps({"success": False, "error": "usage: python -m services.engine.python_engine.video_convert <video> <mp3>"}))
        return 1
    out = convert_video_to_mp3(argv[1], argv[2])
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
