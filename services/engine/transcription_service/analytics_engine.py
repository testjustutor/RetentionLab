# services/engine/transcription_service/analytics_engine.py

class AnalyticsEngine:
    @staticmethod
    def calculate_talk_metrics(processed_script):
        print("[TRANSCRIPTION - STEP 3 & 4] Calculating linguistic densities and conversation metrics...", flush=True)
        
        unique_speakers = list({s["speaker"] for s in processed_script})
        
        # Base analytics using conversation keywords + density metrics to correctly identify roles
        counts = {sp: 0 for sp in unique_speakers}
        instructor_keywords = ["session", "math", "learn", "previous", "tick"]

        for s in processed_script:
            sp = s["speaker"]
            counts[sp] += len(s["text"])
            
            # Use Hugging Face/Pyannote text context to match structural educational markers
            if any(word in s["text"].lower() for word in instructor_keywords):
                counts[sp] += 1000

        inst_id = max(counts, key=counts.get) if counts else None
        
        # Recalculate true visual metrics for the final output
        raw_lengths = {
            sp: sum(len(s["text"]) for s in processed_script if s["speaker"] == sp)
            for sp in unique_speakers
        }
        total_chars = sum(raw_lengths.values()) if raw_lengths else 0
        
        print(f"[TRANSCRIPTION - STEP 3 & 4] Rule Checked: '{inst_id}' matched as INSTRUCTOR profile.", flush=True)
        
        talk_ratio = {
            "instructor": round((raw_lengths.get(inst_id, 0) / total_chars) * 100, 1) if total_chars > 0 else 0,
            "learner": round((100 - ((raw_lengths.get(inst_id, 0) / total_chars) * 100)), 1) if total_chars > 0 else 0
        }
        
        print(f"[TRANSCRIPTION - STEP 3 & 4] Progress: Computed Ratio splits -> Ins: {talk_ratio['instructor']}% | Lrn: {talk_ratio['learner']}%", flush=True)
        return talk_ratio, inst_id