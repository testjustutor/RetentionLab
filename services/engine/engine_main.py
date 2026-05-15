import sys
import os
import json
from textblob import TextBlob
from sentence_transformers import SentenceTransformer

# Custom Service Imports
from media_service import MediaService
from pipeline_service import PipelineService
from audit_service import AuditService
from ai_api_service import AiApiService

class MeetingProcessor:
    def __init__(self, input_file, ai_settings_json):
        self.input_file = input_file
        self.engine_dir = os.path.dirname(os.path.abspath(__file__))
        self.project_root = os.path.abspath(os.path.join(self.engine_dir, "../../"))
        self.db_path = os.path.join(self.project_root, "retention_lab.db")
        
        # Initialize ID and Paths
        filename_no_ext = os.path.splitext(input_file)[0]
        self.base_id = filename_no_ext.replace("REC_", "") if filename_no_ext.startswith("REC_") else filename_no_ext
        self.paths = self._setup_directories()

        # Parse AI Settings and Init Service
        self.ai_config = json.loads(ai_settings_json)
        self.ai_api = AiApiService(self.ai_config)

    def _setup_directories(self):
        dirs = {
            "recordings": os.path.join(self.project_root, "storage", "recordings"),
            "transcripts": os.path.join(self.project_root, "storage", "cache_audio_transcripts"),
            "audits": os.path.join(self.project_root, "storage", "cache_audits"),
            "summaries": os.path.join(self.project_root, "storage", "summaries"),
            "intel": os.path.join(self.project_root, "storage", "intel")
        }
        for path in dirs.values():
            os.makedirs(path, exist_ok=True)
        return dirs

    def run_pipeline(self):
        # 1. Media & Transcription
        recording_full_path = os.path.join(self.paths["recordings"], self.input_file)
        media_service = MediaService(self.project_root)
        audio_path = media_service.extract_audio(recording_full_path)

        pipeline = PipelineService(hf_token=os.getenv("HF_TOKEN"))
        labeled_transcript, talk_ratio, diarization_data = pipeline.process(audio_path)

        # 2. Extract Intelligence (AI-POWERED)
        # Using AI for a high-quality summary instead of the old hardcoded logic
        narrative_text = self.ai_api.ask_ai(
            labeled_transcript, 
            "Provide a professional narrative summary of this meeting transcript."
        )

        # Using AI for smarter sentiment analysis
        ai_sentiment_raw = self.ai_api.ask_ai(
            labeled_transcript, 
            "Analyze the sentiment of this meeting. Return ONLY a single word: Positive, Neutral, or Negative."
        )
        
        # 3. Vector Embeddings (Keeping local for speed/cost)
        intel = self._extract_intel(labeled_transcript)
        intel["sentiment"]["label"] = ai_sentiment_raw.strip().replace(".", "")

        # 4. Audit
        audit_engine = AuditService(self.db_path)
        audit_results = audit_engine.run_audit(labeled_transcript)

        # 5. Persistence
        return self._save_all(
            audio_path, labeled_transcript, talk_ratio, 
            diarization_data, intel, audit_results, narrative_text
        )

    def _extract_intel(self, text):
        # Keep embeddings local because sending large text to API for vectors can be expensive/slow
        model = SentenceTransformer('all-MiniLM-L6-v2')
        vectors = model.encode([text]).tolist()
        
        # TextBlob fallback for score
        analysis = TextBlob(text)
        return {
            "sentiment": {"score": round(analysis.sentiment.polarity, 2)}, 
            "vectors": vectors
        }

    def _save_all(self, audio_path, transcript, ratio, diarization, intel, audit, summary):
        t_path = os.path.join(self.paths["transcripts"], f"TRANS_{self.base_id}.txt")
        d_path = os.path.join(self.paths["transcripts"], f"DIAR_{self.base_id}.json")
        r_path = os.path.join(self.paths["intel"], f"RATIO_{self.base_id}.json")
        s_path = os.path.join(self.paths["intel"], f"SENT_{self.base_id}.json")
        v_path = os.path.join(self.paths["intel"], f"VEC_{self.base_id}.json")
        a_path = os.path.join(self.paths["audits"], f"AUDIT_{self.base_id}.json")
        sum_path = os.path.join(self.paths["summaries"], f"SUMMARY_{self.base_id}.txt")

        with open(t_path, "w", encoding="utf-8") as f: f.write(transcript)
        with open(sum_path, "w", encoding="utf-8") as f: f.write(summary)
        
        for p, data in [(d_path, diarization), (r_path, ratio), (s_path, intel['sentiment']), 
                        (v_path, {"vector": intel['vectors']}), (a_path, audit)]:
            with open(p, "w") as f:
                json.dump(data, f, indent=4 if "json" in p else None)

        return {
            "success": True,
            "meeting_id": self.base_id,
            "summary_path": sum_path,
            "oqi_score": audit.get("oqi_score", 0),
            "evidence_quote": audit.get("evidence_quote", "")
        }

if __name__ == "__main__":
    # Check for TWO arguments now: [filename, ai_settings_json]
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing arguments. Usage: python engine_main.py <file> <ai_json>"}))
        sys.exit(1)

    try:
        # sys.argv[1] is the recording filename
        # sys.argv[2] is the JSON string of settings.ai
        processor = MeetingProcessor(sys.argv[1], sys.argv[2])
        result = processor.run_pipeline()
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)