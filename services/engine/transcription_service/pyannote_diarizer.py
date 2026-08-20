# services/engine/transcription_service/pyannote_diarizer.py

from pyannote.audio import Pipeline
try:
    from pyannote.audio.utils import ProgressHook
    _HAS_PROGRESS_HOOK = True
except Exception:
    ProgressHook = None
    _HAS_PROGRESS_HOOK = False
import torch
import os
import math
import torchaudio
try:
    import requests
except Exception:
    requests = None


class PyannoteDiarizer:

    """
    Speaker diarization using pyannote.
    """

    _PIPELINE = None

    def __init__(
        self,
        hf_token,
        chunk_seconds=60,
        overlap_seconds=5,
        chunk_threshold_seconds=120
    ):

        self.hf_token = hf_token
        self.chunk_seconds = chunk_seconds
        self.overlap_seconds = overlap_seconds
        self.chunk_threshold_seconds = chunk_threshold_seconds

        self.device = torch.device(

            "cuda"
            if torch.cuda.is_available()
            else "cpu"
        )

    # ==========================================
    # LOAD
    # ==========================================

    def load(
        self
    ):

        if self._PIPELINE is None:

            # Probe HF endpoints for likely artifacts (non-fatal)
            try:
                self._probe_hf_files()
            except Exception:
                pass

            self._PIPELINE = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                token=self.hf_token
            )

            self._PIPELINE.to(self.device)

        return self._PIPELINE

    def _probe_hf_files(self):
        """
        Best-effort HEAD-checks against common pyannote model artifact paths
        to surface HTTP status codes similar to the cloude_API traces.
        """
        if requests is None:
            print("[PYANNOTE - HF PROBE] 'requests' not available; skipping HF probes", flush=True)
            return

        repos_and_paths = {
            "pyannote/speaker-diarization-3.1": ["config.yaml"],
            "pyannote/segmentation-3.0": ["pytorch_model.bin"],
            "pyannote/speaker-diarization-community-1": ["plda/xvec_transform.npz", "plda/plda.npz"],
            "pyannote/wespeaker-voxceleb-resnet34-LM": ["pytorch_model.bin"]
        }

        hf_base = "https://huggingface.co"
        headers = {}
        if self.hf_token:
            headers["Authorization"] = f"Bearer {self.hf_token}"

        for repo, paths in repos_and_paths.items():
            for p in paths:
                url = f"{hf_base}/{repo}/resolve/main/{p}"
                try:
                    resp = requests.head(url, headers=headers, allow_redirects=True, timeout=10)
                    print(f"[PYANNOTE - HF PROBE] HTTP Request: HEAD {url} \"{resp.status_code} {resp.reason}\"", flush=True)
                except Exception as e:
                    print(f"[PYANNOTE - HF PROBE] HEAD {url} failed: {e}", flush=True)

    # ==========================================
    # AUDIO HELPERS
    # ==========================================

    def _get_duration(self, audio_path):
        """
        Safely retrieves the duration using soundfile to prevent 
        newer torchaudio dispatch exceptions on Windows paths.
        """
        try:
            import soundfile as sf
            info = sf.info(audio_path)
            return info.duration
        except Exception as sf_err:
            print(f"[PYANNOTE] soundfile duration read failed ({sf_err}). Trying torchaudio fallback...", flush=True)
            info = torchaudio.info(audio_path)
            return info.num_frames / info.sample_rate

    def _extract_chunk(self, audio_path, start, end, out_path):
        """
        Extracts chunks utilizing soundfile to avoid uninitialized backend
        errors on Windows filesystems.
        """
        try:
            import soundfile as sf
            # Read specific frame constraints directly out of file stream
            info = sf.info(audio_path)
            sr = info.samplerate
            start_frame = int(start * sr)
            end_frame = int(end * sr)
            
            data, samplerate = sf.read(audio_path, start=start_frame, stop=end_frame)
            sf.write(out_path, data, samplerate)
        except Exception as sf_err:
            print(f"[PYANNOTE] soundfile chunking failed ({sf_err}), trying torchaudio fallback...", flush=True)
            # Torchaudio fallback
            waveform, sr = torchaudio.load(audio_path)
            start_frame = int(start * sr)
            end_frame = int(end * sr)
            end_frame = min(end_frame, waveform.shape[1])
            chunk = waveform[:, start_frame:end_frame]
            torchaudio.save(out_path, chunk, sr)

    # ==========================================
    # CORE: RUN PIPELINE + PARSE OUTPUT
    # ==========================================

    def _run_pipeline(self, audio_path):

        pipeline = self.load()

        # Use ProgressHook when supported to surface progress on long CPU runs
        hook = None
        if _HAS_PROGRESS_HOOK:
            try:
                hook = ProgressHook()
            except Exception:
                hook = None

        try:
            if hook is not None:
                try:
                    diarization = pipeline(audio_path, progress_hook=hook)
                except TypeError:
                    # some pipeline signatures don't accept progress_hook
                    diarization = pipeline(audio_path)
            else:
                diarization = pipeline(audio_path)
            print(f"[PYANNOTE] diarization type={type(diarization)}", flush=True)
        except Exception as e:
            print(f"[PYANNOTE] pipeline failed: {e}", flush=True)
            raise    
        finally:
            if hook is not None:
                # best-effort simple state report for user visibility
                try:
                    state = getattr(hook, 'state', None)
                    print(f"[PYANNOTE - PROGRESSHOOK] state={state}", flush=True)
                except Exception:
                    pass

        segments = []

        # Support multiple pyannote return types across versions.
        # Older releases return an Annotation-like object with `itertracks`.
        # Newer releases return a DiarizeOutput wrapping `speaker_diarization`
        # (an Annotation). Try the most specific extractors first and
        # gracefully degrade to conservative fallbacks.
        try:
            # Unwrap DiarizeOutput (pyannote 3.1+) to get the Annotation
            if hasattr(diarization, 'speaker_diarization'):
                diarization = diarization.speaker_diarization
            print(f"[PYANNOTE] object after unwrap={type(diarization)}", flush=True)

            if hasattr(diarization, 'itertracks'):
                for turn, _, speaker in (
                    diarization.itertracks(
                        yield_label=True
                    )
                ):
                    segments.append({
                        "speaker": speaker,
                        "start": round(turn.start, 2),
                        "end": round(turn.end, 2)
                    })
            else:
                # Fallback handling for unexpected/other return shapes:
                # prefer label->timeline mapping if available
                # (diarization.labels), otherwise fallback to a generic
                # timeline (diarization.get_timeline()).
                handled = False

                if hasattr(diarization, 'labels'):
                    try:
                        for label, timeline in diarization.labels.items():
                            for seg in timeline:
                                segments.append({
                                    "speaker": label,
                                    "start": round(getattr(seg, 'start', seg[0]), 2),
                                    "end": round(getattr(seg, 'end', seg[1]), 2)
                                })
                        handled = True
                    except Exception:
                        handled = False

                if not handled and hasattr(diarization, 'get_timeline'):
                    try:
                        timeline = diarization.get_timeline()
                        for seg in timeline:
                            # No speaker labels available; assign generic label
                            segments.append({
                                "speaker": "Speaker 1",
                                "start": round(getattr(seg, 'start', seg[0]), 2),
                                "end": round(getattr(seg, 'end', seg[1]), 2)
                            })
                        handled = True
                    except Exception:
                        handled = False

                if not handled:
                    # As a last resort, attempt to iterate the object if it
                    # behaves like an iterable of (segment, label) pairs.
                    try:
                        for item in diarization:
                            # item might be (segment, label) or similar
                            if isinstance(item, tuple) and len(item) >= 2:
                                seg, label = item[0], item[-1]
                                segments.append({
                                    "speaker": getattr(label, 'label', label),
                                    "start": round(getattr(seg, 'start', seg[0]), 2),
                                    "end": round(getattr(seg, 'end', seg[1]), 2)
                                })
                    except Exception:
                        segments = []

        except Exception:
            # Any unexpected shape should not crash the engine; return
            # empty segments to allow the caller's chunk/fallback logic
            # to handle it.
            segments = []

        return segments

    # ==========================================
    # RUN (with chunking for large files)
    # ==========================================

    def diarize(
        self,
        audio_path
    ):

        try:
            duration = self._get_duration(audio_path)
            print(f"[PYANNOTE] total duration={duration:.2f}s", flush=True)
        except Exception as e:
            print(f"[PYANNOTE] could not read duration, running without chunking: {e}", flush=True)
            duration = None

        # Small/short files or unknown duration: run directly, no chunking
        if duration is None or duration <= self.chunk_threshold_seconds:
            return self._run_pipeline(audio_path)

        # ==========================================
        # CHUNKED PROCESSING FOR LARGE FILES
        # ==========================================

        all_segments = []
        speaker_offset_map = {}  # (chunk_index, local_label) -> global_label
        global_speaker_counter = 0

        step = self.chunk_seconds - self.overlap_seconds
        if step <= 0:
            step = self.chunk_seconds

        num_chunks = math.ceil((duration - self.overlap_seconds) / step)
        num_chunks = max(num_chunks, 1)

        tmp_dir = os.path.join(os.path.dirname(audio_path), "_diar_chunks")
        os.makedirs(tmp_dir, exist_ok=True)

        for i in range(num_chunks):
            start = i * step
            end = min(start + self.chunk_seconds, duration)

            if start >= duration:
                break

            chunk_path = os.path.join(tmp_dir, f"chunk_{i}.wav")

            try:
                self._extract_chunk(audio_path, start, end, chunk_path)
            except Exception as e:
                print(f"[PYANNOTE] chunk {i} extraction failed: {e}", flush=True)
                continue

            print(f"[PYANNOTE] processing chunk {i}: {start:.1f}s - {end:.1f}s", flush=True)

            try:
                chunk_segments = self._run_pipeline(chunk_path)
                print(f"[PYANNOTE] chunk {i} returned {len(chunk_segments)} segments",flush=True)
            except Exception as e:
                print(f"[PYANNOTE] chunk {i} diarization failed: {e}", flush=True)
                chunk_segments = []
            finally:
                try:
                    os.remove(chunk_path)
                except Exception:
                    pass

            # Map local speaker labels to global labels. Per-chunk labels
            # (e.g. SPEAKER_00) are not guaranteed consistent across chunks,
            # so each (chunk, local_label) pair gets its own global label.
            for seg in chunk_segments:
                local_label = seg["speaker"]
                key = (i, local_label)
                if key not in speaker_offset_map:
                    speaker_offset_map[key] = f"SPEAKER_{global_speaker_counter:02d}"
                    global_speaker_counter += 1

                all_segments.append({
                    "speaker": speaker_offset_map[key],
                    "start": round(seg["start"] + start, 2),
                    "end": round(seg["end"] + start, 2)
                })

        try:
            os.rmdir(tmp_dir)
        except Exception:
            pass

        all_segments.sort(key=lambda s: s["start"])
        print(f"[PYANNOTE] total segments={len(all_segments)} across {num_chunks} chunks", flush=True)

        return all_segments