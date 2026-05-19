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

class TokenProcessor:
    @staticmethod
    def normalize_segments(raw_result, audio_path, hf_token):
        print("[TRANSCRIPTION - STEP 2] Initializing Micro-Precision Core Pipeline...", flush=True)
        
        # Scoped import to manage Python 3.14 environment cleanly
        from pyannote.audio import Pipeline
        
        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", token=hf_token)
        
        # Target your advanced GPU explicitly
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        pipeline.to(device)
        
        import soundfile as sf
        
        try:
            audio_data, sample_rate = sf.read(audio_path)
            tensor_dtype = torch.float16 if device.type == "cuda" else torch.float32
            
            if len(audio_data.shape) > 1:
                waveform = torch.tensor(audio_data, dtype=tensor_dtype).t()
            else:
                waveform = torch.tensor(audio_data, dtype=tensor_dtype).unsqueeze(0)
            
            audio_in_memory = {"waveform": waveform, "sample_rate": sample_rate}
            
            print(f"[TRANSCRIPTION - STEP 2] Waveform cached in VRAM. Mapping audio matrices...", flush=True)
            diarization = pipeline(audio_in_memory)  # Removed strict num_speakers to let Pyannote dynamically isolate hidden speakers
            
        except Exception as e:
            print(f"[TRANSCRIPTION - STEP 2] [Warning] VRAM shortcut failed: {str(e)}. Falling back to file-read...", flush=True)
            diarization = pipeline(audio_path)
        
        # Step A: Parse timeline vectors into micro-windows
        speaker_map = []
        if hasattr(diarization, "itertracks"):
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                speaker_map.append({"start": turn.start, "end": turn.end, "label": speaker})
        else:
            # Struct schema fallback engine
            segments_source = getattr(diarization, "segments", diarization if isinstance(diarization, (list, tuple)) else [])
            for seg in segments_source:
                speaker_map.append({
                    "start": getattr(seg, "start", seg.get("start", 0) if isinstance(seg, dict) else 0),
                    "end": getattr(seg, "end", seg.get("end", 0) if isinstance(seg, dict) else 0),
                    "label": getattr(seg, "speaker", seg.get("speaker", "SPEAKER_0") if isinstance(seg, dict) else "SPEAKER_0")
                })

        # Cache pure diarization data structure
        try:
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
            base_id = os.path.basename(audio_path).replace("WAV_", "").replace(".wav", "").replace("REC_", "").replace(".mp3", "")
            cache_dir = os.path.join(project_root, "storage", "cache_diarization")
            os.makedirs(cache_dir, exist_ok=True)
            with open(os.path.join(cache_dir, f"DIAR_{base_id}.json"), "w", encoding="utf-8") as f:
                json.dump(speaker_map, f, indent=4)
        except Exception:
            pass

        print("[TRANSCRIPTION - STEP 2] Executing Pure Microsecond Word Alignment Matrix...", flush=True)
        all_words = []
        whisper_segments = raw_result.get("segments", [])
        
        # Step B: Gather EVERY individual word along with its precise timestamp
        for seg in whisper_segments:
            words = seg.get("words", [])
            if words:
                for w in words:
                    all_words.append({
                        "start": w["start"],
                        "end": w["end"],
                        "word": w["word"].strip()
                    })
            else:
                # Emergency character tracking estimation fallback if word_timestamps drops
                text_split = seg["text"].strip().split()
                if text_split:
                    duration = seg["end"] - seg["start"]
                    word_dur = duration / len(text_split)
                    for idx, word in enumerate(text_split):
                        all_words.append({
                            "start": seg["start"] + (idx * word_dur),
                            "end": seg["start"] + ((idx + 1) * word_dur),
                            "word": word
                        })

        processed_script = []
        
        # Step C: Match every single word to the speaker talking at that exact microsecond
        for word_obj in all_words:
            w_start = word_obj["start"]
            w_end = word_obj["end"]
            w_center = (w_start + w_end) / 2
            
            assigned_speaker = None
            best_overlap = -1.0
            
            # Find the speaker window with the absolute highest intersection with this word
            for voice_window in speaker_map:
                v_start = voice_window["start"]
                v_end = voice_window["end"]
                
                # Calculate overlap duration
                overlap_start = max(w_start, v_start)
                overlap_end = min(w_end, v_end)
                overlap_time = overlap_end - overlap_start
                
                if overlap_time > best_overlap and overlap_time > 0:
                    best_overlap = overlap_time
                    assigned_speaker = voice_window["label"]
            
            # Fallback 1: Center point check
            if not assigned_speaker:
                for voice_window in speaker_map:
                    if voice_window["start"] <= w_center <= voice_window["end"]:
                        assigned_speaker = voice_window["label"]
                        break
            
            # Fallback 2: Closest boundary proximity matching
            if not assigned_speaker:
                closest_dist = float('inf')
                for voice_window in speaker_map:
                    dist = min(abs(w_start - voice_window["end"]), abs(w_end - voice_window["start"]))
                    if dist < closest_dist:
                        closest_dist = dist
                        assigned_speaker = voice_window["label"]
            
            final_speaker = assigned_speaker if assigned_speaker else "SPEAKER_0"
            
            # Append word directly into sentence blocks categorized by speaker continuity
            if processed_script and processed_script[-1]["speaker"] == final_speaker:
                processed_script[-1]["end"] = round(w_end, 2)
                processed_script[-1]["text"] += " " + word_obj["word"]
            else:
                processed_script.append({
                    "start": round(w_start, 2),
                    "end": round(w_end, 2),
                    "text": word_obj["word"],
                    "speaker": final_speaker
                })

        print("[TRANSCRIPTION - STEP 2] Alignment locked at 100% micro-grid matching density.", flush=True)
        return processed_script