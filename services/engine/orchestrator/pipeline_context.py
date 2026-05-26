import os
import json
from threading import Lock


class PipelineContext:
    """
    Shared runtime state container for all pipeline tasks.

    This object safely stores:
    - shared artifacts
    - generated paths
    - runtime metadata
    - task outputs
    - feature flags
    """

    def __init__(self, input_file, ai_config, project_root):
        self._lock = Lock()

        self.input_file = input_file
        self.ai_config = ai_config
        self.project_root = project_root

        filename_no_ext = os.path.splitext(input_file)[0]

        self.base_id = (
            filename_no_ext.replace("REC_", "")
            if filename_no_ext.startswith("REC_")
            else filename_no_ext
        )

        self.storage_paths = self._setup_directories()

        self.db_path = os.path.join(
            self.project_root,
            "retention_lab.db"
        )

        # ==========================================
        # PIPELINE FEATURE FLAGS
        # ==========================================
        features = self.ai_config.get(
            "pipeline_features",
            self.ai_config
        )

        self.enable_media = self.str_to_bool(
            features.get("media_extraction"),
            True
        )

        self.enable_transcription = self.str_to_bool(
            features.get("transcription"),
            True
        )

        self.enable_intel = self.str_to_bool(
            features.get("intel_extraction"),
            False
        )

        self.enable_audit = self.str_to_bool(
            features.get("ai_audit"),
            False
        )

        self.enable_summary = self.str_to_bool(
            features.get("summary_generation"),
            False
        )

        self.enable_topics = self.str_to_bool(
            features.get("topic_clustering"),
            False
        )

        # ==========================================
        # SHARED PIPELINE ARTIFACTS
        # ==========================================
        self.audio_path = None
        self.transcript_path = None
        self.sentiment_path = None
        self.vector_path = None
        self.audit_json_path = None
        self.summary_path = None

        self.labeled_transcript = ""
        self.diarization_data = None
        self.talk_ratio = None

        self.audit_results = {}

        self.intel = {
            "sentiment": None,
            "vectors": None,
            "topics": None
        }

        # ==========================================
        # TASK EXECUTION STATUS
        # ==========================================
        self.task_status = {
            "media": "pending",
            "transcription": "pending",
            "intel": "pending",
            "audit": "pending",
            "summary": "pending",
            "topics": "pending"
        }

        # ==========================================
        # RUNTIME METADATA
        # ==========================================
        self.execution_metadata = {
            "started_tasks": [],
            "completed_tasks": [],
            "failed_tasks": []
        }

    @staticmethod
    def str_to_bool(val, default=True):
        if isinstance(val, bool):
            return val

        if isinstance(val, str):
            return val.lower() in ("true", "1", "yes")

        return default

    def _setup_directories(self):
        storage_base = os.path.join(
            self.project_root,
            "storage"
        )

        dirs = {
            "recordings": os.path.join(
                storage_base,
                "recordings"
            ),

            "summaries": os.path.join(
                storage_base,
                "summaries"
            ),

            "intel": os.path.join(
                storage_base,
                "intel"
            ),

            # ==========================================
            # AUDIO + TRANSCRIPTION CACHE
            # ==========================================

            "wav_audio": os.path.join(
                storage_base,
                "cache_wav_audio"
            ),

            "cache_whisper": os.path.join(
                storage_base,
                "cache_whisper"
            ),

            "cache_voice_activity": os.path.join(
                storage_base,
                "cache_voice_activity"
            ),

            "cache_diarization": os.path.join(
                storage_base,
                "cache_diarization"
            ),

            "cache_captions_raw": os.path.join(
                storage_base,
                "cache_captions_raw"
            ),

            "cache_chat_logs": os.path.join(
                storage_base,
                "cache_chat_logs"
            ),

            "cache_screenshots": os.path.join(
                storage_base,
                "cache_screenshots"
            ),

            "cache_audio_transcripts": os.path.join(
                storage_base,
                "cache_audio_transcripts"
            ),

            # ==========================================
            # AI / NLP CACHE
            # ==========================================

            "cache_embeddings": os.path.join(
                storage_base,
                "cache_embeddings"
            ),

            "cache_topic_trackers": os.path.join(
                storage_base,
                "cache_topic_trackers"
            ),

            "cache_llm_prompts": os.path.join(
                storage_base,
                "cache_llm_prompts"
            ),

            "cache_voiceprints": os.path.join(
                storage_base,
                "cache_voiceprints"
            ),

            "audits": os.path.join(
                storage_base,
                "cache_audits"
            ),

            "cache_audits": os.path.join(
                storage_base,
                "cache_audits"
            )
        }

        for path in dirs.values():
            os.makedirs(path, exist_ok=True)

        return dirs

    # ==========================================
    # THREAD SAFE HELPERS
    # ==========================================

    def mark_task_started(self, task_name):
        with self._lock:
            self.task_status[task_name] = "running"
            self.execution_metadata["started_tasks"].append(task_name)

    def mark_task_completed(self, task_name):
        with self._lock:
            self.task_status[task_name] = "completed"
            self.execution_metadata["completed_tasks"].append(task_name)

    def mark_task_failed(self, task_name):
        with self._lock:
            self.task_status[task_name] = "failed"
            self.execution_metadata["failed_tasks"].append(task_name)

    # ==========================================
    # FINAL RESPONSE PAYLOAD
    # ==========================================

    def build_final_response(self):
        return {
            "success": True,
            "meeting_id": self.base_id,
            "audio_path": self.audio_path,
            "transcript_path": self.transcript_path,
            "sentiment_path": self.sentiment_path,
            "vector_path": self.vector_path,
            "audit_json_path": self.audit_json_path,
            "summary_path": self.summary_path,
            "oqi_score": self.audit_results.get("oqi_score", 0)
        }
