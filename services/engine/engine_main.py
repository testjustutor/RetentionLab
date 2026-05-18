import sys
import os
import json
from textblob import TextBlob

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(line_buffering=True)

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "../.."))

if project_root not in sys.path:
    sys.path.insert(0, project_root)

from utils.logger_util import logger
from services.engine.media_service import MediaService
from services.engine.transcription_service import TranscriptionService 
from services.engine.ai_api_service import AiApiService 
from services.engine.ai_audit_service import AiAuditService   
from services.engine.summary_service import SummaryService   
from services.engine.topic_service import TopicService       

class MeetingProcessor:
    def __init__(self, input_file, ai_settings_json):
        self.input_file = input_file
        self.project_root = project_root
        self.db_path = os.path.join(self.project_root, "retention_lab.db")
        filename_no_ext = os.path.splitext(input_file)[0]
        self.base_id = filename_no_ext.replace("REC_", "") if filename_no_ext.startswith("REC_") else filename_no_ext
        self.paths = self._setup_directories()
        
        self.ai_config = json.loads(ai_settings_json)
        self.ai_api = AiApiService(self.ai_config)
        self._embedding_model = None

        # --- PIPELINE CONTROLS (Defaults to True if not provided) ---
        # Extracts pipeline configurations from features dictionary or top-level keys
        features = self.ai_config.get("pipeline_features", self.ai_config)
        
        def str_to_bool(val, default=True):
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                return val.lower() in ("true", "1", "yes")
            return default

        self.enable_media = str_to_bool(features.get("media_extraction"), True)
        self.enable_transcription = str_to_bool(features.get("transcription"), True)
        self.enable_intel = str_to_bool(features.get("intel_extraction"), False)
        self.enable_audit = str_to_bool(features.get("ai_audit"), False)
        self.enable_summary = str_to_bool(features.get("summary_generation"), False)
        self.enable_topics = str_to_bool(features.get("topic_clustering"), False)

    def _setup_directories(self):
        storage_base = os.path.join(self.project_root, "storage")
        dirs = {
            "recordings": os.path.join(storage_base, "recordings"),
            "wav_audio": os.path.join(storage_base, "cache_wav_audio"),
            "transcripts": os.path.join(storage_base, "cache_audio_transcripts"),
            "audits": os.path.join(storage_base, "cache_audits"),
            "summaries": os.path.join(storage_base, "summaries"),
            "intel": os.path.join(storage_base, "intel")
        }
        for path in dirs.values():
            os.makedirs(path, exist_ok=True)
        return dirs

    def run_pipeline(self):
        print("\n" + "="*65, flush=True)
        print(f"INITIALIZING DECOUPLED MICROSERVICE BACKEND | MEETING REF: {self.base_id}", flush=True)
        print("="*65 + "\n", flush=True)

        recording_full_path = os.path.join(self.paths["recordings"], self.input_file)
        
        # Initialize pipeline result path placeholders as None
        audio_path = None
        transcript_path = None
        sentiment_path = None
        vector_path = None
        audit_json_path = None
        summary_path = None
        audit_results = {}
        labeled_transcript = ""
        diarization_data = None
        talk_ratio = None
        intel = {"sentiment": None, "vectors": None, "topics": None}

        # ==========================================
        # STEP 1: Media Service (Audio Extraction)
        # ==========================================
        if self.enable_media:
            print("[GLOBAL ORCHESTRATOR] STEP 1/5: Extracting track frames via Media Microservice...", flush=True)
            media_service = MediaService(self.project_root)
            audio_path = media_service.extract_audio(recording_full_path)
            print("[GLOBAL ORCHESTRATOR] PIPELINE PROGRESS: 15% completed.\n", flush=True)
        else:
            print("[GLOBAL ORCHESTRATOR] STEP 1/5: Skipped (Media Extraction disabled).", flush=True)
            # Fallback assuming audio file might already match the output expected if processing a pre-extracted file
            audio_path = os.path.join(self.paths["wav_audio"], f"WAV_{self.base_id}.wav") 

        # ==========================================
        # STEP 2: Transcription Microservice
        # ==========================================
        if self.enable_transcription:
            print("[GLOBAL ORCHESTRATOR] STEP 2/5: Processing speech structures via Layered Engine...", flush=True)
            labeled_transcript, talk_ratio, diarization_data = TranscriptionService(
                hf_token=os.getenv("HF_TOKEN")
            ).process(audio_path)

            transcript_path = os.path.join(self.paths["transcripts"], f"TRANS_{self.base_id}.txt")
            with open(transcript_path, "w", encoding="utf-8") as f:
                f.write(labeled_transcript)
            print("[GLOBAL ORCHESTRATOR] PIPELINE PROGRESS: 45% completed.\n", flush=True)
        else:
            print("[GLOBAL ORCHESTRATOR] STEP 2/5: Skipped (Transcription disabled).", flush=True)
            # If transcription is disabled, check if cached transcript file exists to allow downstream steps to run
            transcript_path = os.path.join(self.paths["transcripts"], f"TRANS_{self.base_id}.txt")
            if os.path.exists(transcript_path):
                with open(transcript_path, "r", encoding="utf-8") as f:
                    labeled_transcript = f.read()

        # ==========================================
        # OPTIONAL: Local Intel Extraction (Sentiment / Vectors)
        # ==========================================
        if self.enable_intel and labeled_transcript:
            print("[GLOBAL ORCHESTRATOR] Status: Running local text classification algorithms...", flush=True)
            intel = self._extract_intel(labeled_transcript, talk_ratio)

            sentiment_path = os.path.join(self.paths["intel"], f"SENT_{self.base_id}.json")
            with open(sentiment_path, "w", encoding="utf-8") as f:
                json.dump(intel["sentiment"], f, indent=4)

            vector_path = os.path.join(self.paths["intel"], f"VEC_{self.base_id}.json")
            with open(vector_path, "w", encoding="utf-8") as f:
                json.dump({"vector": intel["vectors"]}, f, indent=4)
        else:
            print("[GLOBAL ORCHESTRATOR] Status: Local Intel/Vector extraction skipped or missing transcript.", flush=True)

        # ==========================================
        # STEP 3: AI Audit Evaluation
        # ==========================================
        if self.enable_audit and labeled_transcript:
            print("[GLOBAL ORCHESTRATOR] STEP 3/5: Handoff to AI Evaluation Microservice Folder...", flush=True)
            audit_engine = AiAuditService(self.db_path, self.ai_config)
            audit_results = audit_engine.process_audit(labeled_transcript)

            audit_json_path = os.path.join(self.paths["audits"], f"AUDIT_{self.base_id}.json")
            with open(audit_json_path, "w", encoding="utf-8") as f:
                json.dump(audit_results, f, indent=4)
            print("[GLOBAL ORCHESTRATOR] PIPELINE PROGRESS: 70% completed.\n", flush=True)
        else:
            print("[GLOBAL ORCHESTRATOR] STEP 3/5: Skipped (AI Audit disabled or missing transcript).", flush=True)

        # ==========================================
        # STEP 4: AI Summary Generation
        # ==========================================
        if self.enable_summary and labeled_transcript:
            print("[GLOBAL ORCHESTRATOR] STEP 4/5: Handoff to AI Summary Generation Microservice Folder...", flush=True)
            summary_engine = SummaryService(self.ai_config)
            summary_text = summary_engine.generate_meeting_summary(labeled_transcript)

            summary_path = os.path.join(self.paths["summaries"], f"SUMMARY_{self.base_id}.txt")
            with open(summary_path, "w", encoding="utf-8") as f:
                f.write(summary_text)
            print("[GLOBAL ORCHESTRATOR] PIPELINE PROGRESS: 85% completed.\n", flush=True)
        else:
            print("[GLOBAL ORCHESTRATOR] STEP 4/5: Skipped (AI Summary disabled or missing transcript).", flush=True)

        # ==========================================
        # STEP 5: Chronological Topic Clustering
        # ==========================================
        if self.enable_topics and diarization_data is not None:
            print("[GLOBAL ORCHESTRATOR] STEP 5/5: Handoff to Algorithmic Clustering Microservice Folder...", flush=True)
            topic_engine = TopicService()
            topic_clusters = topic_engine.compute_clusters(diarization_data)
            intel['topics'] = topic_clusters
            print("[GLOBAL ORCHESTRATOR] PIPELINE PROGRESS: 95% completed.\n", flush=True)
        else:
            print("[GLOBAL ORCHESTRATOR] STEP 5/5: Skipped (Topic Clustering disabled or missing diarization data).", flush=True)

        print("\n" + "="*65, flush=True)
        print("[GLOBAL ORCHESTRATOR] PIPELINE EXECUTION COMPLETED!", flush=True)
        print("="*65 + "\n", flush=True)

        return {
            "success": True,
            "meeting_id": self.base_id,
            "audio_path": audio_path,
            "transcript_path": transcript_path,
            "sentiment_path": sentiment_path,
            "vector_path": vector_path,
            "audit_json_path": audit_json_path,
            "summary_path": summary_path,
            "oqi_score": audit_results.get("oqi_score", 0)  # Defaults smoothly to 0 if skipped
        }

    def _extract_intel(self, text, talk_ratio=None):
        analysis = TextBlob(text)
        score = round(analysis.sentiment.polarity, 2)
        label = "Positive" if score > 0.1 else ("Negative" if score < -0.1 else "Neutral")

        vectors = None
        try:
            import torch
            from sentence_transformers import SentenceTransformer
            if not self._embedding_model:
                device = "cuda" if torch.cuda.is_available() else "cpu"
                self._embedding_model = SentenceTransformer('all-MiniLM-L6-v2', device=device)
            vectors = self._embedding_model.encode([text], show_progress_bar=False).tolist()
        except Exception:
            vectors = None

        return {
            "checkpoint_ratios": talk_ratio,
            "sentiment": {"score": score, "label": label},
            "vectors": vectors
        }

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("input_file")
    parser.add_argument("ai_settings_json")
    args = parser.parse_args()

    processor = MeetingProcessor(args.input_file, args.ai_settings_json)
    result = processor.run_pipeline()
    print(json.dumps(result))