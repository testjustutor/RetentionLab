# services/engine/transcription_service/token_processor.py

class TokenProcessor:
    @staticmethod
    def normalize_segments(raw_result):
        print("[TRANSCRIPTION - STEP 2] Parsing segment structures and normalising floating decimals...", flush=True)
        processed_script = []
        segments = raw_result.get("segments", [])
        total_segments = len(segments)
        
        for idx, seg in enumerate(segments):
            processed_script.append({
                "start": round(seg["start"], 2),
                "end": round(seg["end"], 2),
                "text": seg["text"].strip(),
                "speaker": "SPEAKER_1" if seg["id"] % 2 == 0 else "SPEAKER_2",
            })
            
            if total_segments > 15 and idx % max(1, total_segments // 4) == 0:
                percent = int((idx / total_segments) * 100)
                print(f"[TRANSCRIPTION - STEP 2] Progress: Standardizing script objects... {percent}% complete.", flush=True)

        print("[TRANSCRIPTION - STEP 2] Progress: Standard structural matrix built in heap memory.", flush=True)
        return processed_script