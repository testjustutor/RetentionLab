"""
services/python_engine/resemblyzer_diarizer.py

Speaker diarization using Resemblyzer (speaker embedding + clustering).

Fully independent of the legacy engine. If Resemblyzer is not installed, the
diarizer returns a single "SPEAKER_00" track covering the whole file so the
pipeline still produces well-formed output.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from utils.logger_util import log_with_type

# numpy is a hard dependency of Resemblyzer; import lazily so the module can
# still be imported (and degrade) when Resemblyzer is absent.


class ResemblyzerDiarizer:
    """Segment audio by speaker using Resemblyzer embeddings + agglomerative
    clustering over windowed features."""

    def __init__(
        self,
        window_seconds: float = 3.0,
        step_seconds: float = 1.0,
        n_speakers: Optional[int] = None,
        progress_cb=None,
    ):
        self.window_seconds = window_seconds
        self.step_seconds = step_seconds
        self.n_speakers = n_speakers
        # progress_cb(percent:int) -> called during windowed embedding
        self.progress_cb = progress_cb

    def _report(self, pct: int) -> None:
        try:
            if self.progress_cb:
                self.progress_cb(int(max(0, min(100, pct))))
        except Exception:
            pass

    # ------------------------------------------------------------------
    def _load_wav(self, audio_path: str):
        try:
            import soundfile as sf

            data, sr = sf.read(audio_path, dtype="float32")
            # mono-ize
            if data.ndim > 1:
                data = data.mean(axis=1)
            return data, sr
        except Exception:
            # Last-resort: torchaudio
            import torchaudio  # noqa

            wav, sr = torchaudio.load(audio_path)
            data = wav.mean(dim=0).numpy()
            return data.astype("float32"), int(sr)

    def diarize(self, audio_path: str) -> Dict[str, Any]:
        try:
            from resemblyzer import VoiceEncoder, preprocess_wav
            from sklearn.cluster import AgglomerativeClustering
        except Exception as exc:
            # Resemblyzer (or sklearn) absent -> degrade to single speaker.
            log_with_type("warning", f"resemblyzer_diarizer: unavailable ({exc}) -> single SPEAKER_00", "PYTHON_ENGINE")
            return {
                "available": False,
                "diarization": [
                    {"start": 0.0, "end": None, "speaker": "Speaker 1"}
                ],
                "error": f"Resemblyzer unavailable: {exc}",
            }

        log_with_type("info", "resemblyzer_diarizer: Resemblyzer available, running diarization", "PYTHON_ENGINE")
        # NOTE: _load_wav failures (bad/corrupt audio, missing soundfile+torchaudio)
        # used to propagate all the way up to pipeline.py's outer except, which
        # silently set diarization=[] with no fallback speaker label at all
        # (segments ended up with speaker=null). Catch it here instead so we
        # always return a well-formed single-speaker fallback.
        try:
            data, sr = self._load_wav(audio_path)
        except Exception as exc:
            log_with_type("warning", f"resemblyzer_diarizer: failed to load audio ({exc}) -> single Speaker 1", "PYTHON_ENGINE")
            return {
                "available": False,
                "diarization": [
                    {"start": 0.0, "end": None, "speaker": "Speaker 1"}
                ],
                "error": f"audio load failed: {exc}",
            }
        duration = len(data) / sr if sr else 0.0

        encoder = VoiceEncoder()
        wav = preprocess_wav(data, source_sr=sr)

        win = int(sr * self.window_seconds)
        step = int(sr * self.step_seconds)
        if win <= 0 or step <= 0:
            return {
                "available": True,
                "diarization": [{"start": 0.0, "end": duration, "speaker": "Speaker 1"}],
            }

        # Collect windowed embeddings
        starts: List[float] = []
        feats: List = []
        pos = 0
        last_pct = -1
        while pos + win <= len(wav):
            chunk = wav[pos : pos + win]
            try:
                emb = encoder.embed_utterance(chunk)
            except Exception:
                emb = None
            if emb is not None:
                feats.append(emb)
                starts.append(pos / sr)
            pos += step
            # Diarization progress: how many windows processed (0-100)
            total_windows = max(1, ((len(wav) - win) // step) + 1)
            done = min(total_windows, len(starts))
            pct = int((done / total_windows) * 100)
            if pct != last_pct and pct % 10 == 0:
                self._report(pct)
                last_pct = pct
        if not feats:
            log_with_type("warning", "resemblyzer_diarizer: no embeddings extracted -> single speaker", "PYTHON_ENGINE")
            return {
                "available": True,
                "diarization": [{"start": 0.0, "end": duration, "speaker": "Speaker 1"}],
            }

        # STEP 1: force the speaker count for 1:1 tutor-student calls.
        # Default is exactly 2 (tutor + student) instead of auto-detection.
        n_speakers = self.n_speakers or 2
        n_clusters = min(max(int(n_speakers), 1), len(feats))
        if n_clusters != n_speakers:
            log_with_type(
                "warning",
                f"resemblyzer_diarizer: requested {n_speakers} speakers but only {len(feats)} embeddings; using {n_clusters}",
                "PYTHON_ENGINE",
            )
        else:
            log_with_type("info", f"resemblyzer_diarizer: forcing num_speakers={n_clusters}", "PYTHON_ENGINE")

        cluster = AgglomerativeClustering(n_clusters=n_clusters).fit(feats)
        labels = list(cluster.labels_)

        # Map cluster id -> stable speaker label ordered by first appearance
        order: List[int] = []
        for lab in labels:
            if lab not in order:
                order.append(lab)
        speaker_of = {lab: f"SPEAKER_{i:02d}" for i, lab in enumerate(order)}

        # Windowed clusters -> segment boundaries (merge consecutive same labels)
        segments: List[Dict[str, Any]] = []
        cur_speaker: Optional[str] = None
        cur_start = 0.0
        for i, lab in enumerate(labels):
            spk = speaker_of[lab]
            seg_start = starts[i]
            if cur_speaker is None:
                cur_speaker = spk
                cur_start = seg_start
            elif spk != cur_speaker:
                segments.append({"start": cur_start, "end": seg_start, "speaker": cur_speaker})
                cur_speaker = spk
                cur_start = seg_start
        if cur_speaker is not None:
            segments.append({"start": cur_start, "end": duration, "speaker": cur_speaker})

        log_with_type("info", f"resemblyzer_diarizer: finished -> {len(order)} speakers, {len(segments)} segments", "PYTHON_ENGINE")
        return {"available": True, "diarization": segments, "speakers": len(order)}