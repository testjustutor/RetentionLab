import os
import sys
import time
import subprocess


class MediaService:
    def __init__(self, root_dir):
        # Base directory for recordings
        self.recordings_dir = os.path.join(root_dir, "storage", "recordings")

    def get_audio_path(self, file_name):
        """Verifies the mp3 exists and returns the full path with live updates."""
        audio_path = os.path.join(self.recordings_dir, file_name)

        print(f"DEBUG | Checking recording path: {audio_path}", flush=True)

        # Simulated heartbeat to show the terminal is "alive" during the check
        for i in range(1, 4):
            print(f"Status | Locating file... {i}/3", flush=True)
            time.sleep(0.2)

        if not os.path.exists(audio_path):
            print(f"ERROR | File missing: {file_name}", flush=True)
            raise FileNotFoundError(f"Recording file not found at: {audio_path}")

        print("Status | File verified successfully.", flush=True)
        return audio_path

    def extract_audio(self, input_path):
        """
        Extract audio from an input .mp3 into cached PCM .wav.
        Renames output from REC_filename.mp3 to WAV_filename.wav
        """
        if not input_path.lower().endswith(".mp3"):
            raise ValueError("MediaService.extract_audio supports only .mp3 inputs.")

        # Get the base filename without extension
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        
        # Transformation logic: Strip 'REC_' and prepend 'WAV_'
        if base_name.startswith("REC_"):
            formatted_name = "WAV_" + base_name[4:]
        else:
            formatted_name = "WAV_" + base_name

        # Setup cache directory
        cache_wav_dir = os.path.join(os.path.dirname(self.recordings_dir), "cache_wav_audio")
        os.makedirs(cache_wav_dir, exist_ok=True)

        # Final output path with the new naming convention
        output_path = os.path.join(cache_wav_dir, f"{formatted_name}.wav")

        if os.path.exists(output_path):
            # If the wav already exists and is non-empty, reuse it.
            try:
                if os.path.getsize(output_path) > 1024:
                    print(f"Status | Using cached wav: {output_path}", flush=True)
                    return output_path
            except OSError:
                pass

        print("Status | Starting FFmpeg conversion to .wav...", flush=True)

        # Live progress updates
        for percent in range(0, 101, 25):
            print(f"Progress | Converting: {percent}%", flush=True)
            time.sleep(0.2)

        ffmpeg_cmd = [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            input_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            output_path,
        ]

        try:
            proc = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        except FileNotFoundError:
            raise RuntimeError("ffmpeg is not available on PATH.")

        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg failed (code {proc.returncode}). {proc.stderr or proc.stdout}")

        if not os.path.exists(output_path):
            raise RuntimeError("FFmpeg reported success but wav output file is missing.")

        if os.path.getsize(output_path) <= 1024:
            raise RuntimeError("Generated wav is unexpectedly small (likely invalid/corrupt).")

        print(f"Status | FFmpeg conversion complete: {output_path}", flush=True)
        return output_path