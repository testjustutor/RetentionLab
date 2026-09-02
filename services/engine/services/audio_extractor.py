# services/engine/services/audio_extractor.py

import os
import subprocess


class AudioExtractor:

    """
    FFmpeg audio extractor.
    """

    def __init__(
        self,
        context
    ):

        self.context = context

    # ==========================================
    # EXTRACT AUDIO
    # ==========================================

    def extract(
        self,
        input_path
    ):

        output_path = os.path.join(

            self.context.storage_paths[
                "wav_audio"
            ],

            f"WAV_{self.context.base_id}.wav"
        )

        command = [

            "ffmpeg",

            "-y",

            "-i",
            input_path,

            "-ac",
            "1",

            "-ar",
            "16000",

            output_path
        ]

        # Basic validations
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        out_dir = os.path.dirname(output_path)
        if out_dir and not os.path.exists(out_dir):
            try:
                os.makedirs(out_dir, exist_ok=True)
            except Exception as e:
                raise RuntimeError(f"Failed to create output directory {out_dir}: {e}")

        # Ensure ffmpeg is available
        try:
            from shutil import which
            if which('ffmpeg') is None:
                raise EnvironmentError('ffmpeg not found in PATH')
        except Exception:
            # If shutil.which isn't available for some reason, let ffmpeg run and fail clearly
            pass

        # Run ffmpeg and capture stderr/stdout to provide a clearer error when it fails
        proc = subprocess.run(
            command,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        if proc.returncode != 0:
            # Re-raise a CalledProcessError including captured output for debugging
            raise subprocess.CalledProcessError(proc.returncode, proc.args, output=proc.stdout, stderr=proc.stderr)

        return output_path
