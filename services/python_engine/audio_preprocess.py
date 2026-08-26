"""
services/python_engine/audio_preprocess.py

Audio preprocessing before transcription/diarization (STEP 4):
    1. ffmpeg `loudnorm` - normalize volume so quiet speech is not missed.
    2. `noisereduce` - spectral noise reduction for hiss/fan/background noise.

Writes `<name>.prep.wav` next to the source; the original is never modified.

Also STEP 5 helper: detect/split per-participant channels (stereo L/R).
"""
import os
import subprocess
from typing import Any, Dict, Optional, Tuple

from utils.logger_util import log_with_type

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


class AudioPreprocessor:
    def __init__(self, enabled: bool = True, denoise: bool = True):
        self.enabled = enabled
        self.denoise = denoise

    def _ffprobe_channels(self, path: str) -> int:
        try:
            out = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "a:0",
                 "-show_entries", "stream=channels",
                 "-of", "default=noprint_wrappers=1:nokey=1", path],
                capture_output=True, text=True, timeout=60,
            )
            return int(out.stdout.strip() or 1)
        except Exception:
            return 1

    def _loudnorm(self, src: str, dst: str) -> bool:
        try:
            # NOTE: do NOT pass -ac 1 here - downmixing to mono before the
            # channel check would make per-participant detection impossible
            # (STEP 5 relies on the prepped file still being stereo).
            subprocess.run(
                ["ffmpeg", "-y", "-i", src,
                 "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                 "-ar", "16000", dst],
                capture_output=True, text=True, timeout=1800,
            )
            return os.path.exists(dst)
        except Exception as e:
            log_with_type("warning", f"audio_preprocess: loudnorm failed -> {e}", "PYTHON_ENGINE")
            return False

    @staticmethod
    def _denoise_wav(path: str):
        """Denoise the WAV **in place** (single output file). Returns True on success."""
        try:
            import soundfile as sf
            from noisereduce import reduce_noise

            data, sr = sf.read(path, dtype="float32")
            if data.ndim > 1:
                data = data.mean(axis=1)
            reduced = reduce_noise(y=data, sr=sr)
            sf.write(path, reduced.astype("float32"), sr)  # overwrite in place
            return True
        except Exception as e:
            log_with_type("warning", f"audio_preprocess: denoise skipped -> {e}", "PYTHON_ENGINE")
            return False

    def preprocess(self, audio_path: str):
        """Return (path_to_use, info). Falls back to the original on failure.

        Produces a SINGLE preprocessed WAV: `<base>.prep.wav` containing the
        loudnorm-normalized AND denoised audio. No extra `.denoised.wav` copy.
        """
        info = {"preprocessed": False, "channels": 1, "split_channels": False}
        if not self.enabled or not audio_path or not os.path.exists(audio_path):
            return audio_path, info

        base = os.path.splitext(audio_path)[0]
        prepped = f"{base}.prep.wav"

        if not os.path.exists(prepped) or os.path.getsize(prepped) == 0:
            log_with_type("info", "audio_preprocess: normalizing volume (ffmpeg loudnorm)", "PYTHON_ENGINE")
            if not self._loudnorm(audio_path, prepped):
                log_with_type("warning", "audio_preprocess: preprocessing unavailable - using original audio", "PYTHON_ENGINE")
                return audio_path, info

        info["preprocessed"] = True

        # STEP 5: per-participant channels (stereo L/R == 2 speakers)
        channels = self._ffprobe_channels(prepped)
        info["channels"] = channels
        if channels >= 2:
            split = split_stereo_channels(prepped)
            if split:
                info["split_channels"] = True
                info["channel_files"] = [split["left"], split["right"]]
                log_with_type("info", "audio_preprocess: stereo -> per-participant channels available", "PYTHON_ENGINE")

        # Denoise in place so we keep a single simple WAV file.
        if self.denoise:
            if self._denoise_wav(prepped):
                info["denoised"] = True

        return prepped, info


def split_stereo_channels(audio_path: str):
    """STEP 5 helper: split a stereo recording into left/right mono WAVs.
    Returns {'left': path, 'right': path} when the source is stereo."""
    if not audio_path or not os.path.exists(audio_path):
        return None
    base = os.path.splitext(audio_path)[0]
    left = f"{base}.chL.wav"
    right = f"{base}.chR.wav"
    results = {}
    for name, spec in (("left", "c0"), ("right", "c1")):
        dst = left if name == "left" else right
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", audio_path, "-af",
                 f"pan=mono|c0={spec}", "-ar", "16000", "-ac", "1", dst],
                capture_output=True, text=True, timeout=900,
            )
            if os.path.exists(dst) and os.path.getsize(dst) > 1000:
                results[name] = dst
        except Exception:
            pass
    return results if len(results) == 2 else None