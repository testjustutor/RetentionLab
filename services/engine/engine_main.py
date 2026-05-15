import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "../.."))

if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
from textblob import TextBlob

from utils.logger_util import logger

from services.engine.media_service import MediaService
from services.engine.pipeline_service import PipelineService
from services.engine.audit_service import AuditService
from services.engine.ai_api_service import AiApiService

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

    def _setup_directories(self):
        storage_base = os.path.join(self.project_root, "storage")
        dirs = {
            "recordings": os.path.join(storage_base, "recordings"),
            "transcripts": os.path.join(storage_base, "cache_audio_transcripts"),
            "audits": os.path.join(storage_base, "cache_audits"),
            "summaries": os.path.join(storage_base, "summaries"),
            "intel": os.path.join(storage_base, "intel")
        }
        for path in dirs.values():
            os.makedirs(path, exist_ok=True)
        return dirs

    def run_pipeline(self):
        recording_full_path = os.path.join(self.paths["recordings"], self.input_file)

        media_service = MediaService(self.project_root)
        audio_path = media_service.extract_audio(recording_full_path)

        transcript_path = None
        labeled_transcript, talk_ratio, diarization_data = PipelineService(
            hf_token=os.getenv("HF_TOKEN")
        ).process(audio_path)

        transcript_path = os.path.join(self.paths["transcripts"], f"TRANS_{self.base_id}.txt")
        with open(transcript_path, "w", encoding="utf-8") as f:
            f.write(labeled_transcript)

        intel = self._extract_intel(labeled_transcript)

        sentiment_path = os.path.join(self.paths["intel"], f"SENT_{self.base_id}.json")
        with open(sentiment_path, "w", encoding="utf-8") as f:
            json.dump(intel["sentiment"], f, indent=4)

        vector_path = os.path.join(self.paths["intel"], f"VEC_{self.base_id}.json")
        with open(vector_path, "w", encoding="utf-8") as f:
            json.dump({"vector": intel["vectors"]}, f, indent=4)

        audit_engine = AuditService(self.db_path)
        audit_results = audit_engine.run_audit(labeled_transcript)

        audit_json_path = os.path.join(self.paths["audits"], f"AUDIT_{self.base_id}.json")
        with open(audit_json_path, "w", encoding="utf-8") as f:
            json.dump(audit_results, f, indent=4)

        summary_text = f"Meeting processed locally. Total transcript length: {len(labeled_transcript)} characters."
        summary_path = os.path.join(self.paths["summaries"], f"SUMMARY_{self.base_id}.txt")
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write(summary_text)

        return {
            "success": True,
            "meeting_id": self.base_id,
            "audio_path": audio_path,
            "transcript_path": transcript_path,
            "sentiment_path": sentiment_path,
            "vector_path": vector_path,
            "audit_json_path": audit_json_path,
            "summary_path": summary_path,
            "oqi_score": audit_results.get("oqi_score", 0)
        }

    def _extract_intel(self, text):
        analysis = TextBlob(text)
        score = round(analysis.sentiment.polarity, 2)

        if score > 0.1:
            label = "Positive"
        elif score < -0.1:
            label = "Negative"
        else:
            label = "Neutral"

        vectors = None
        try:
            import torch
            from sentence_transformers import SentenceTransformer

            if not self._embedding_model:
                device = "cuda" if torch.cuda.is_available() else "cpu"
                self._embedding_model = SentenceTransformer(
                    'all-MiniLM-L6-v2',
                    device=device
                )

            vectors = self._embedding_model.encode(
                [text],
                show_progress_bar=False
            ).tolist()

        except Exception:
            embeddings = None

        return {
            "sentiment": {"score": score, "label": label},
            "vectors": vectors
        }

    def _save_all(self, audio_path, transcript, ratio, diarization, intel, audit, summary):
        file_map = {
            "TRANS": (self.paths["transcripts"], transcript, False),
            "SUMMARY": (self.paths["summaries"], summary, False),
            "DIAR": (self.paths["transcripts"], diarization, True),
            "RATIO": (self.paths["intel"], ratio, True),
            "SENT": (self.paths["intel"], intel['sentiment'], True),
            "VEC": (self.paths["intel"], intel['vectors'], True),
            "AUDIT": (self.paths["audits"], audit, True),
        }

        for prefix, (folder, data, is_json) in file_map.items():
            ext = ".json" if isjson else ".txt"
            p = os.path.join(folder, f"{prefix}_{self.base_id}{ext}")
            with open(p, "w", encoding="utf-8") as f:
                if isjson:
                    json.dump(data, f, indent=4)
                else:
                    f.write(str(data))

        return {
            "success": True,
            "meeting_id": self.base_id,
            "oqi_score": audit.get("oqi_score", 0)
        }

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("input_file")
    parser.add_argument("ai_settings_json")
    args = parser.parse_args()

    processor = MeetingProcessor(
        args.input_file,
        args.ai_settings_json
    )

    result = processor.run_pipeline()

    print(json.dumps(result))