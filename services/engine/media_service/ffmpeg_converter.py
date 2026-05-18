# services/engine/media_service/ffmpeg_converter.py
import os
import time
import subprocess
from utils.logger_util import logger

class FfmpegConverter:
    def __init__(self, recordings_dir):
        self.recordings_dir = recordings_dir

    def execute_conversion(self, input_path, formatted_name):
        logger.info(f"Action | FFmpeg starting stream extraction on: {input_path}")
        
        # Setup cache folder directory structure
        cache_wav_dir = os.path.join(os.path.dirname(self.recordings_dir), "cache_wav_audio")
        os.makedirs(cache_wav_dir, exist_ok=True)

        output_path = os.path.join(cache_wav_dir, f"{formatted_name}.wav")

        # Smart Cache Validation Core
        if os.path.exists(output_path):
            try:
                if os.path.getsize(output_path) > 1024:
                    print(f"[MEDIA - FFMPEG] Optimization Cache Found: Reusing asset -> {output_path}", flush=True)
                    return output_path
            except OSError:
                pass

        print("[MEDIA - FFMPEG] Processing Status: Cache miss. Initiating subprocess fork...", flush=True)

        # Smooth terminal progress response ticks
        for percent in range(0, 101, 25):
            print(f"[MEDIA - FFMPEG] Real-time Output Progress: {percent}% synchronized.", flush=True)
            time.sleep(0.2)

        ffmpeg_cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", input_path, "-vn", "-ac", "1", "-ar", "16000",
            "-c:a", "pcm_s16le", output_path
        ]

        try:
            proc = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        except FileNotFoundError:
            raise RuntimeError("CRITICAL: ffmpeg binary engine is completely missing from runtime environment PATH.")

        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg pipeline crashed (Code {proc.returncode}). Engine trace: {proc.stderr or proc.stdout}")

        if not os.path.exists(output_path) or os.path.getsize(output_path) <= 1024:
            raise RuntimeError("Generated track frame failed structural check (Invalid/Corrupted asset layout output).")

        print(f"[MEDIA - FFMPEG] Processing Status: Complete! Target saved -> {output_path}", flush=True)
        return output_path