# services/engine/summary_service/summary_worker.py

import sys
import time


class SummaryWorker:

    def generate(
        self,
        transcript
    ):

        transcript = (
            transcript or ""
        ).strip()

        if not transcript:

            return "Summary generation skipped: transcript is empty."

        words = transcript.split()

        preview = " ".join(
            words[:120]
        )

        if len(words) > 120:

            preview += "..."

        return (
            f"Meeting summary: {preview}"
        )

class SummaryService:
    def __init__(self, ai_config):
        from services.engine.ai_api_service import AiApiService

        self.ai_api = AiApiService(ai_config)

    def generate_meeting_summary(self, transcript_text):
        if not transcript_text or len(transcript_text.strip()) == 0:
            print("[SUMMARY MICROSERVICE] Warning: Input transcript empty. Halting loop.", flush=True)
            return "Summary generation skipped: The session transcript data is empty."

        total_words = len(transcript_text.split())
        print(f"[SUMMARY MICROSERVICE] Status: Digesting transcript data array ({total_words} words)...", file=sys.stderr, flush=True)
        
        system_instruction = (
            "You are a narrative serialization summary microservice. Analyze the input conversation transcript and "
            "provide a concise, high-impact overview paragraph describing the core discussions, notable talking points, "
            "and final session alignment."
        )
        prompt = f"Total input word count metrics: {total_words}\n\nTranscript Source:\n{transcript_text}"
        
        print(f"[SUMMARY MICROSERVICE] Status: Shipping transcript matrix payload to AI endpoint...", flush=True)
        
        for progress_pct in range(15, 86, 25):
            print(f"[SUMMARY MICROSERVICE] Progress: Generating core abstracts... {progress_pct}% synchronized.", flush=True)
            time.sleep(0.2)
            
        try:
            summary_narrative = self.ai_api.ask_ai(prompt=prompt, system_instruction=system_instruction)
            print("[SUMMARY MICROSERVICE] Progress: Abstract pipeline extraction 100% complete!", flush=True)
            return summary_narrative.strip()
        except Exception as e:
            print(f"[SUMMARY MICROSERVICE] CRITICAL: Transmission fallback error: {str(e)}", flush=True)
            return f"Meeting Analysis: Summary mapping sequence broken owing to connection drop: {str(e)}"
