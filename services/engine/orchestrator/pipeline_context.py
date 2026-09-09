# services/engine/orchestrator/pipeline_context.py

import os
import re
import json
from threading import Lock


def compute_base_id(input_file):
    """Derive the shared `base_id` naming stem from an input recording's
    filename (bare name or full path - only the leaf name is used).

    This is the SAME stem used to name every cached artifact across the
    pipeline (WAV_<base_id>.wav, AUDIO_TRANS_<base_id>.txt, AUDIT_<base_id>.json,
    etc.) - factored out here so any caller that needs to name a file the same
    way a PipelineContext would (e.g. the admin video-processing pipeline in
    services/engine/pipeline.py) gets IDENTICAL results without re-implementing
    this logic.
    """
    filename_no_ext = os.path.splitext(os.path.basename(input_file))[0]
    return (
        filename_no_ext.replace("REC_", "")
        if filename_no_ext.startswith("REC_")
        else filename_no_ext
    )


def build_storage_paths(project_root):
    """Build (and create) the shared storage cache folders used across the
    whole engine. Factored out of PipelineContext._setup_directories so any
    caller that needs to write into the SAME established folders (e.g. the
    admin video-processing pipeline) reuses this instead of hard-coding its
    own paths/folders.
    """
    storage_base = os.path.join(
        project_root,
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

        # base_id is used for all file naming - see compute_base_id() above.
        self.base_id = compute_base_id(input_file)

        # Backwards-compatibility aliases used by audit and other task handlers.
        # NOTE: meeting_id is resolved to the REAL numeric meetings.id (via
        # meeting_sessions, with a meetings.external_meeting_id fallback that
        # also CREATES the meeting_sessions mapping row when missing - see
        # _resolve_meeting_id/_ensure_session_row below) so ai_audit_results /
        # meeting_assets store the FK id instead of the filename-derived base_id.
        # base_id is still used for all file naming.
        #
        # CONVERGENCE: a caller that already knows the real DB ids (Node
        # resolves them server-side before invoking the engine - both the
        # bot-recording flow via services/socraticbot.js and the admin
        # video-processing flow via videoProcessingController.js now forward
        # them through pythonBridge.js as ai_config["meeting_id"] / ["session_id"])
        # takes priority over filename-regex resolution. This is REQUIRED for
        # admin-uploaded "named video" recordings, whose filenames can encode a
        # generic, non-unique external_meeting_id token (e.g. "Regular") that
        # would otherwise risk resolving to the WRONG meetings row via the
        # unscoped DB fallback in _resolve_meeting_id() below. Filename-regex
        # resolution remains the fallback for callers that don't supply ids
        # (e.g. test-engine.js ad-hoc runs with no DB context at all).
        explicit_session_id = self._coerce_int(self.ai_config.get("session_id"))
        explicit_meeting_id = self._coerce_int(self.ai_config.get("meeting_id"))

        if explicit_session_id is not None:
            self.session_id = explicit_session_id
        else:
            self.session_id = self._resolve_session_id(self.base_id)

        if explicit_meeting_id is not None:
            self.meeting_id = explicit_meeting_id
        else:
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

        self.enable_tutor_eval = self.str_to_bool(
            features.get("tutor_eval"),
            False
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

        self.tutor_eval_results = {}

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
            "tutor_eval": "pending",
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
    def _coerce_int(val):
        """Best-effort int coercion for a caller-supplied meeting_id/session_id,
        which may arrive as a JSON number, a numeric string, None, or simply be
        absent from ai_config. Returns None when val is falsy/blank or not
        coercible, so callers can cleanly fall back to filename-regex resolution."""
        if val is None or val == "":
            return None
        try:
            return int(val)
        except (TypeError, ValueError):
            return None

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

        # Fuzzy fallback: match any TRANS_*.txt whose stem shares the meeting id +
        # session, so a pre-existing transcript in storage/transcripts is found
        # even when base_id and the stored filename differ (naming/date).
        try:
            # Derive a clean meeting key from the basename, dropping any REC_ prefix
            # and path so "storage\\recordings\\REC_fkx-mkrk-mbq_Sess3..." -> "fkx-mkrk-mbq"
            import re as _re
            base = os.path.basename(self.base_id or "").lower()
            if base.startswith("rec_"):
                base = base[4:]
            raw_key = _re.sub(r"(_sess\d+|_\d+|_20\d{2}.*)$", "", base).strip("_")
            base_session = self._session_from_key(base)
            for directory in search_dirs:
                if not os.path.isdir(directory):
                    continue
                for candidate in sorted(os.listdir(directory)):
                    low = candidate.lower()
                    if not (low.startswith("trans_") and low.endswith(".txt")):
                        continue
                    stem = candidate[6:-4].lower()
                    if not (raw_key and self._transcript_matches(stem, raw_key)):
                        continue
                    # Prefer a transcript whose session matches the current one,
                    # so Sess3 doesn't pick up Sess2's file.
                    cand_session = self._session_from_key(stem)
                    if base_session is not None and cand_session is not None and cand_session != base_session:
                        continue
                    return os.path.join(directory, candidate)
        except Exception:
            pass

        # Not found — diarization will proceed with SPEAKER_XX labels
        return None

    @staticmethod
    def _session_from_key(key):
        """Extract _Sess<N> (case-insensitive) from a filename/key, else None."""
        import re as _re
        m = _re.search(r"_sess(\d+)", key, re.IGNORECASE)
        return int(m.group(1)) if m else None

    def _transcript_matches(self, stem, meeting_key):
        """True if a TRANS file stem and the meeting key share meet id + session."""
        import re as _re
        strip = lambda s: _re.sub(r"(_sess\d+|_\d+|_20\d{2}.*)$", "", s).strip("_")
        return bool(strip(meeting_key)) and (
            strip(stem).startswith(strip(meeting_key)) or strip(meeting_key) in strip(stem)
        )

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
          2. Fallback: the filename encodes the platform's external meeting id
             as the leading segment before "_SessN" (e.g.
             "82014705313_Sess159_..."). Resolve THAT via
             meetings.external_meeting_id, and if found, create the
             meeting_sessions mapping row via _ensure_session_row() so every
             future lookup for this session_id hits the fast path above
             instead of repeating this fallback every run.

        Returns:
            meetings.id (int) if resolvable/created, otherwise None (the caller
            falls back to base_id so file writes never break).
        """
        if not session_id:
            return None
        try:
            from database.python_db import fetch_one

            # 1) Fast path: existing session row already maps to meetings.id
            row = fetch_one(
                "SELECT meeting_id FROM meeting_sessions WHERE id = %s LIMIT 1",
                (int(session_id),)
            )
            if row and row.get("meeting_id"):
                return row["meeting_id"]

            # 2) Fallback: resolve via meetings.external_meeting_id parsed from
            # the filename, then create the mapping row so this doesn't have
            # to be repeated on every future run for this session.
            m = re.match(r"^([^_]+)_Sess\d+", self.base_id)
            if m:
                external_id = m.group(1)
                meeting_row = fetch_one(
                    "SELECT id FROM meetings WHERE external_meeting_id = %s LIMIT 1",
                    (external_id,)
                )
                if meeting_row and meeting_row.get("id"):
                    resolved_meeting_id = meeting_row["id"]
                    self._ensure_session_row(session_id, resolved_meeting_id)
                    return resolved_meeting_id
                else:
                    print(
                        f"[PIPELINE CONTEXT] WARNING: No meetings row for "
                        f"external_meeting_id={external_id!r} (session={session_id}). "
                        f"meeting_id cannot be resolved; falling back to base_id.",
                        flush=True
                    )
            else:
                print(
                    f"[PIPELINE CONTEXT] WARNING: base_id={self.base_id!r} does not "
                    f"match the '<external_id>_SessN' pattern; cannot derive "
                    f"external_meeting_id for session={session_id}.",
                    flush=True
                )

        except Exception as e:
            print(
                f"[PIPELINE CONTEXT] WARNING: Could not resolve meeting_id for "
                f"session={session_id}: {e}",
                flush=True
            )
        return None

    def _ensure_session_row(self, session_id, meeting_id):
        """Upsert a meeting_sessions row linking session_id -> meetings.id so
        downstream resolution (ai_audit_results + Node bridge) sees the mapping.

        Called from _resolve_meeting_id() the first time a session_id has no
        existing meeting_sessions row but a meeting was found via
        external_meeting_id, so subsequent runs hit the fast path directly."""
        from database.python_db import execute
        execute(
            "INSERT INTO meeting_sessions (id, meeting_id, start_time, status) "
            "VALUES (%s, %s, CURRENT_TIMESTAMP, 'completed') "
            "ON DUPLICATE KEY UPDATE meeting_id = VALUES(meeting_id)",
            (session_id, meeting_id)
        )

    def _setup_directories(self):
        return build_storage_paths(self.project_root)

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
        # FIX: this used to return self.base_id (the filename-derived string,
        # e.g. "82014705313_Sess159_2026-06-12_16-01") as "meeting_id", even
        # though __init__ already resolves the REAL numeric meetings.id into
        # self.meeting_id (falling back to base_id only when resolution truly
        # fails). pythonBridge.js on the Node side then had to re-derive the
        # session id by regex-parsing this string a second time
        # (resolveMeetingContext), which was redundant and broke if the
        # filename format ever changed.
        #
        # Now: "meeting_id" is the already-resolved value (numeric id, or
        # base_id ONLY as a genuine last resort), and session_id/base_id are
        # surfaced explicitly so callers never need to re-parse anything.
        return {
            "success": True,
            "meeting_id": self.meeting_id,
            "session_id": self.session_id,
            "base_id": self.base_id,
            "audio_path": self.audio_path,
            "transcript_path": self.transcript_path,
            "audit_json_path": self.audit_json_path,
            "summary_path": self.summary_path,
            "oqi_score": self.audit_results.get("oqi_score", 0)
        }