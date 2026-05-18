# services/engine/transcription_service/formatter.py

class Formatter:
    @staticmethod
    def build_labeled_string(processed_script, instructor_id):
        print("[TRANSCRIPTION - STEP 5] Mapping string buffer layouts into standard role formatting...", flush=True)
        transcript_with_labels = ""
        
        for seg in processed_script:
            role = "INSTRUCTOR" if seg["speaker"] == instructor_id else "LEARNER"
            transcript_with_labels += f"[{role}]: {seg['text']}\n"
            
        print("[TRANSCRIPTION - STEP 5] Progress: 100% complete. String buffer locked.", flush=True)
        return transcript_with_labels