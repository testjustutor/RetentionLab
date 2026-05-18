# services/engine/transcription_service/analytics_engine.py

class AnalyticsEngine:
    @staticmethod
    def calculate_talk_metrics(processed_script):
        print("[TRANSCRIPTION - STEP 3 & 4] Calculating linguistic densities and conversation metrics...", flush=True)
        
        unique_speakers = list({s["speaker"] for s in processed_script})
        counts = {
            sp: sum(len(s["text"]) for s in processed_script if s["speaker"] == sp)
            for sp in unique_speakers
        }
        
        inst_id = max(counts, key=counts.get) if counts else None
        total_chars = sum(counts.values()) if counts else 0
        
        print(f"[TRANSCRIPTION - STEP 3 & 4] Rule Checked: '{inst_id}' matched as INSTRUCTOR profile.", flush=True)
        
        talk_ratio = {
            "instructor": round((counts.get(inst_id, 0) / total_chars) * 100, 1) if total_chars > 0 else 0,
            "learner": round((100 - ((counts.get(inst_id, 0) / total_chars) * 100)), 1) if total_chars > 0 else 0
        }
        
        print(f"[TRANSCRIPTION - STEP 3 & 4] Progress: Computed Ratio splits -> Ins: {talk_ratio['instructor']}% | Lrn: {talk_ratio['learner']}%", flush=True)
        return talk_ratio, inst_id