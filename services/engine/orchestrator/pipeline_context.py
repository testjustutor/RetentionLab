# root/services/engine/orchestrator/pipeline_context.py

import os
import re
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

        # Backwards-compatibility aliases used by audit and other task handlers.
        # NOTE: meeting_id is resolved to the REAL numeric meetings.id (via
        # meeting_sessions) so ai_audit_results / meeting_assets store the FK id
        # instead of the filename-derived base_id. base_id is still used for all
        # file naming.
        self.session_id = self._resolve_session_id(filename_no_ext)
        self.meeting_id = self._resolve_meeting_id(self.session_id) or self.base_id

        self.storage_paths = self._setup_directories()

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

        self.enable_audit = self.str_to_bool(
            features.get("ai_audit"),
            False
        )

        self.enable_summary = self.str_to_bool(
            features.get("summary_generation"),
            False
        )

        self.enable_persist_results = self.str_to_bool(
            features.get("persist_results"),
            True
        )

        # ==========================================
        # SHARED PIPELINE ARTIFACTS
        # ==========================================
        self.audio_path = None
        self.transcript_path = None
        self.audit_json_path = None
        self.summary_path = None

        self.labeled_transcript = ""
        self.diarization_data = None
        self.talk_ratio = None

        self.audit_results = {}

        # Structured outputs produced by the AI tasks and consumed by
        # the persist_results task.
        self.summary_data = {}

        # ==========================================
        # CAPTIONS TRANSCRIPT (Teams / Zoom / Meet)
        # Resolved at startup from storage/transcripts
        # using base_id (strip trailing chunk suffix)
        # ==========================================
        self.captions_trans_path = self._resolve_captions_trans_path()
        self.meeting_start = None   # set by transcription_task after parsing header

        # ==========================================
        # TASK EXECUTION STATUS
        # ==========================================
        self.task_status = {
            "media": "pending",
            "transcription": "pending",
            "audit": "pending",
            "summary": "pending",
            "persist_results": "pending"
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

    def _resolve_captions_trans_path(self):
        """
        Locates the platform captions transcript (TRANS_*.txt) for this session.

        The TRANS file is written by the bot (Teams / Zoom / Google Meet) and
        stored in storage/transcripts. Its filename mirrors base_id but without
        the trailing chunk suffix (_2, _3, etc.).

        Example:
            base_id   : meeting_<id>_Sess28_2026-06-12_16-01_2
            TRANS file: TRANS_meeting_<id>_Sess28_2026-06-12_16-01.txt
        """
        import re

        # Strip trailing chunk number (_2, _3 …) to get the session-level stem
        trans_stem = re.sub(r"_\d+$", "", self.base_id)
        trans_filename = f"TRANS_{trans_stem}.txt"

        # Search directories in priority order
        search_dirs = [
            os.path.join(self.project_root, "storage", "transcripts"),
            os.path.join(self.project_root, "storage", "cache_captions_raw"),
            os.path.join(self.project_root, "storage"),
        ]

        for directory in search_dirs:
            candidate = os.path.join(directory, trans_filename)
            if os.path.exists(candidate):
                return candidate

        # Not found — diarization will proceed with SPEAKER_XX labels
        return None

    def _resolve_session_id(self, filename_no_ext):
        match = re.search(r"_Sess(\d+)(?:_|$)", filename_no_ext)
        if match:
            return int(match.group(1))
        return None

    def _resolve_meeting_id(self, session_id):
        """
        Resolve the REAL numeric meetings.id for a session — and if needed,
        ensure the meeting/session rows exist — so ai_audit_results.meeting_id
        is ALWAYS an integer (meetings.id) and never the filename string.

        Resolution order:
          1. meeting_sessions.meeting_id for the given session_id (fast path).
          
        Returns:
            meetings.id (int) if resolvable/created, otherwise None (the caller
            falls back to base_id so file writes never break).
        """
        if not session_id:
            return None
        try:
            from database.python_db import fetch_one, execute, insert

            # 1) Fast path: existing session row already maps to meetings.id
            row = fetch_one(
                "SELECT meeting_id FROM meeting_sessions WHERE id = %s LIMIT 1",
                (int(session_id),)
            )
            if row and row.get("meeting_id"):
                return row["meeting_id"]

        except Exception as e:
            print(
                f"[PIPELINE CONTEXT] WARNING: Could not resolve meeting_id for "
                f"session={session_id}: {e}",
                flush=True
            )
        return None

    def _ensure_session_row(self, session_id, meeting_id):
        """Upsert a meeting_sessions row linking session_id -> meetings.id so
        downstream resolution (ai_audit_results + Node bridge) sees the mapping."""
        from database.python_db import execute
        execute(
            "INSERT INTO meeting_sessions (id, meeting_id, start_time, status) "
            "VALUES (%s, %s, CURRENT_TIMESTAMP, 'completed') "
            "ON DUPLICATE KEY UPDATE meeting_id = VALUES(meeting_id)",
            (session_id, meeting_id)
        )

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

            "cache_llm_prompts": os.path.join(
                storage_base,
                "cache_llm_prompts"
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
            "audit_json_path": self.audit_json_path,
            "summary_path": self.summary_path,
            "oqi_score": self.audit_results.get("oqi_score", 0)
        }