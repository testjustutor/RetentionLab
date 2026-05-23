# services/engine/transcription_service/token_processor.py
import os
import json
import whisperx
import torch

class TokenProcessor:
    @staticmethod
    def normalize_segments(aligned_result, audio_path, hf_token):
        print("[TRANSCRIPTION - STEP 2] Initializing WhisperX Diarization Pipeline Engine...", flush=True)
        
        # Dynamically switch between CUDA and CPU based on your system configuration
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[TRANSCRIPTION - STEP 2] Running execution device mapped to: {device.upper()}", flush=True)
        
        # Initialize the WhisperX Diarization wrapper (uses Pyannote inside)
        diarize_model = whisperx.DiarizationPipeline(
            use_auth_token=hf_token if hf_token else True, 
            device=device
        )
        
        print("[TRANSCRIPTION - STEP 2] Running Voice Activity Detection & Clustering...", flush=True)
        audio = whisperx.load_audio(audio_path)
        diarize_segments = diarize_model(audio)
        
        print("[TRANSCRIPTION - STEP 2] Auto-mapping structural word arrays directly onto speaker IDs...", flush=True)
        final_segments_output = whisperx.assign_word_speakers(diarize_segments, aligned_result)
        
        processed_script = []
        
        # Format the output data structure into the identical schema expected by your downstream services
        for seg in final_segments_output.get("segments", []):
            processed_script.append({
                "start": round(seg.get("start", 0.0), 2),
                "end": round(seg.get("end", 0.0), 2),
                "text": seg.get("text", "").strip(),
                "speaker": seg.get("speaker", "UNKNOWN_SPEAKER")
            })
            
        # Cache raw diarization arrays for your downstream topic clustering engine (TopicService)
        try:
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
            base_id = os.path.basename(audio_path).replace("WAV_", "").replace(".wav", "").replace("REC_", "").replace(".mp3", "")
            cache_dir = os.path.join(project_root, "storage", "cache_diarization")
            os.makedirs(cache_dir, exist_ok=True)
            
            # Safe row parsing that works perfectly across both Pandas 1.x and 2.x dataframes
            speaker_map = []
            for idx, row in diarize_segments.iterrows():
                speaker_map.append({
                    "start": float(row.get("start", 0.0) if hasattr(row, "get") else row["start"]),
                    "end": float(row.get("end", 0.0) if hasattr(row, "get") else row["end"]),
                    "label": str(row.get("speaker", "UNKNOWN") if hasattr(row, "get") else row["speaker"])
                })
                
            with open(os.path.join(cache_dir, f"DIAR_{base_id}.json"), "w", encoding="utf-8") as f:
                json.dump(speaker_map, f, indent=4)
        except Exception as e:
            print(f"[TRANSCRIPTION - STEP 2] [Warning] Failed to write structural DIAR cache: {str(e)}", flush=True)

        print("[TRANSCRIPTION - STEP 2] Alignment locked via native WhisperX matrix mapping.")
        return processed_script