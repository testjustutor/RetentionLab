# services/engine/transcription_service/token_processor.py
import os
import json
import sys
import torch
import torchaudio

# 1. Hotfix for missing backend list method in newer torchaudio versions
if not hasattr(torchaudio, "list_audio_backends"):
    torchaudio.list_audio_backends = lambda: ["ffmpeg" if hasattr(torchaudio, "utils") else "soxr"]

# 2. Hotfix for missing 'io' submodule or StreamReader class inside SpeechBrain context
if not hasattr(torchaudio, "io"):
    class MockStreamReader:
        pass
    
    from types import ModuleType
    mock_io = ModuleType("torchaudio.io")
    mock_io.StreamReader = MockStreamReader
    torchaudio.io = mock_io
    sys.modules["torchaudio.io"] = mock_io

from pyannote.audio import Pipeline

class TokenProcessor:
    @staticmethod
    def normalize_segments(raw_result, audio_path, hf_token):
        print("[TRANSCRIPTION - STEP 2] Loading Pyannote Neural Diarization from Hugging Face...", flush=True)
        
        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", token=hf_token)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        pipeline.to(device)
        
        print(f"[TRANSCRIPTION - STEP 2] Running Neural Diarization on {device.type.upper()}...", flush=True)
        diarization = pipeline(audio_path, num_speakers=2)
        
        # Build speaker map matrix safely supporting all version output definitions
        speaker_map = []
        
        if hasattr(diarization, "itertracks"):
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                speaker_map.append({
                    "start": turn.start,
                    "end": turn.end,
                    "label": speaker
                })
        elif hasattr(diarization, "itervalues") or isinstance(diarization, (list, tuple)) or hasattr(diarization, "segments"):
            segments_source = diarization.segments if hasattr(diarization, "segments") else diarization
            for seg in segments_source:
                speaker_map.append({
                    "start": getattr(seg, "start", seg.get("start", 0) if isinstance(seg, dict) else 0),
                    "end": getattr(seg, "end", seg.get("end", 0) if isinstance(seg, dict) else 0),
                    "label": getattr(seg, "speaker", getattr(seg, "label", seg.get("speaker", "SPEAKER_1") if isinstance(seg, dict) else "SPEAKER_1"))
                })
        else:
            try:
                for segment in getattr(diarization, "to_diarization", lambda: diarization)().itersegments():
                    speaker_map.append({
                        "start": segment.start,
                        "end": segment.end,
                        "label": getattr(diarization, "get_labels", lambda s: "SPEAKER_1")(segment)
                    })
            except Exception:
                for line in str(diarization).split('\n'):
                    if '->' in line:
                        try:
                            parts = line.strip().replace('[', '').replace(']', '').split()
                            start_str = parts[0]
                            end_str = parts[2]
                            spk_str = parts[-1]
                            
                            def to_sec(t_str):
                                h, m, s = t_str.split(':')
                                return int(h)*3600 + int(m)*60 + float(s)
                                
                            speaker_map.append({
                                "start": to_sec(start_str),
                                "end": to_sec(end_str),
                                "label": spk_str
                            })
                        except Exception:
                            continue

        # Cache fully built Pyannote structure to your storage directory
        try:
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
            base_id = os.path.basename(audio_path).replace("WAV_", "").replace(".wav", "").replace("REC_", "").replace(".mp3", "")
            cache_dir = os.path.join(project_root, "storage", "cache_diarization")
            os.makedirs(cache_dir, exist_ok=True)
            
            with open(os.path.join(cache_dir, f"DIAR_{base_id}.json"), "w", encoding="utf-8") as f:
                json.dump(speaker_map, f, indent=4)
        except Exception as e:
            print(f"[TRANSCRIPTION - STEP 2] [Warning] Failed to cache diarization artifacts: {str(e)}", flush=True)

        def match_speaker(timestamp):
            for seg in speaker_map:
                if seg["start"] <= timestamp <= seg["end"]:
                    return seg["label"]
            return "UNKNOWN"

        print("[TRANSCRIPTION - STEP 2] Aligning Whisper text tracks with Neural Speaker Labels...", flush=True)
        processed_script = []
        segments = raw_result.get("segments", [])
        
        for seg in segments:
            midpoint = (seg["start"] + seg["end"]) / 2
            assigned_speaker = match_speaker(midpoint)
            
            if assigned_speaker == "UNKNOWN":
                assigned_speaker = match_speaker(seg["start"])

            processed_script.append({
                "start": round(seg["start"], 2),
                "end": round(seg["end"], 2),
                "text": seg["text"].strip(),
                "speaker": assigned_speaker if assigned_speaker != "UNKNOWN" else "SPEAKER_0"
            })

        print("[TRANSCRIPTION - STEP 2] Neural alignment complete. Matrix built in heap memory.", flush=True)
        return processed_script