# root/services/engine/manual/run_diarization.py
"""
Manual / on-demand speaker diarization for a specific meeting/session.

This script is intentionally decoupled from the automatic pipeline
PipelineRunner / DependencyGraph. Diarization does NOT run during
media -> transcription -> [audit, summary] -> persist_results.

It loads an already-transcribed meeting (Whisper cache JSON), runs pyannote
speaker diarization against the audio, merges speaker labels onto the existing
transcript segments, computes talk_ratio, writes the DIAR / RATIO / CAPTIONS
cache files, and persists talk_ratio + speaker segments to the
`session_diarization` table — all directly, without a pipeline task.

Usage:

    python services/engine/manual/run_diarization.py --meeting_id=2 \
        --session_id=159 --audio_path=storage/audio/REC_xxx.wav

    # Optional: override where the Whisper transcript cache is read from
    python services/engine/manual/run_diarization.py --meeting_id=2 \
        --session_id=159 --audio_path=storage/audio/REC_xxx.wav \
        --whisper_path=storage/cache_whisper/WHISPER_xxx.json
"""

import argparse
import json
import os
import sys

# ==========================================
# PROJECT ROOT SETUP (same as engine_main.py)
# ==========================================
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "..", "..", ".."))

if project_root not in sys.path:
    sys.path.insert(0, project_root)


from utils.logger_util import log_with_type

from services.engine.transcription_service.diarization_engine import (
    DiarizationEngine
)

from services.engine.transcription_service.transcript_builder import (
    TranscriptBuilder
)

from services.engine.task.transcription.cache_manager import (
    TranscriptionCacheManager
)

from services.engine.shared.json_store import (
    JsonStore
)

from database.python_db import execute


# ==========================================================
# STORAGE PATHS (mirrors PipelineContext._setup_directories)
# ==========================================================

def build_storage_paths():
    storage_base = os.path.join(project_root, "storage")

    dirs = {
        "cache_whisper": os.path.join(storage_base, "cache_whisper"),
        "cache_voice_activity": os.path.join(storage_base, "cache_voice_activity"),
        "cache_diarization": os.path.join(storage_base, "cache_diarization"),
        "cache_captions_raw": os.path.join(storage_base, "cache_captions_raw"),
        "cache_audio_transcripts": os.path.join(storage_base, "cache_audio_transcripts"),
    }

    for path in dirs.values():
        os.makedirs(path, exist_ok=True)

    return dirs
# ==========================================================
# CAPTIONS TRANSCRIPT RESOLUTION
# ==========================================================

def resolve_captions_trans_path(base_id):
    """Locate the platform captions transcript (TRANS_*.txt) for a session."""
    import re

    # Strip trailing chunk number (_2, _3 …) to get the session-level stem
    trans_stem = re.sub(r"_\d+$", "", base_id)
    trans_filename = f"TRANS_{trans_stem}.txt"

    search_dirs = [
        os.path.join(project_root, "storage", "transcripts"),
        os.path.join(project_root, "storage", "cache_captions_raw"),
        os.path.join(project_root, "storage"),
    ]

    for directory in search_dirs:
        candidate = os.path.join(directory, trans_filename)
        if os.path.exists(candidate):
            return candidate

    return None


def parse_meeting_start(trans_path):
    """Extract meeting wall-clock start time from the TRANS_*.txt header."""
    import re
    from datetime import datetime

    if not trans_path:
        return None

    header_date_re = re.compile(
        r"Date\s*:\s*(\d+/\d+/\d+),?\s+(\d+:\d+:\d+\s+[AP]M)",
        re.IGNORECASE,
    )

    try:
        with open(trans_path, encoding="utf-8") as f:
            for _ in range(20):
                line = f.readline()
                if not line:
                    break
                match = header_date_re.search(line)
                if match:
                    return datetime.strptime(
                        f"{match.group(1)} {match.group(2)}",
                        "%m/%d/%Y %I:%M:%S %p",
                    )
    except Exception:
        pass

# ==========================================================
# MANUAL DIARIZATION ENTRYPOINT
# ==========================================================

def run_manual_diarization(meeting_id, session_id, audio_path, whisper_path=None):
    """Run pyannote diarization on-demand for an existing meeting transcript."""

    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio path not found: {audio_path}")

    base_id = os.path.splitext(os.path.basename(audio_path))[0]
    base_id = base_id.replace("WAV_", "").replace("REC_", "").replace(".wav", "").replace(".mp3", "")

    # ==========================================================
    # Resolve the existing Whisper transcript cache (do NOT re-run Whisper)
    # ==========================================================

    storage_paths = build_storage_paths()

    if not whisper_path:
        whisper_path = os.path.join(storage_paths["cache_whisper"], f"WHISPER_{base_id}.json")

    if os.path.exists(whisper_path):
        with open(whisper_path, "r", encoding="utf-8") as f:
            whisper_result = json.load(f)
        log_with_type("info", f"Engine(manual > run_diarization) : Loaded Whisper transcript from cache path={whisper_path}", "MANUAL_DIARIZATION")
    else:
        log_with_type("warning", f"Engine(manual > run_diarization) : No Whisper transcript cache found at {whisper_path} — using empty segments", "MANUAL_DIARIZATION")
        whisper_result = {"segments": []}

    # ==========================================================
    # Build a minimal context (same shape DiarizationEngine expects)
    # ==========================================================

    captions_trans_path = resolve_captions_trans_path(base_id)
    meeting_start = parse_meeting_start(captions_trans_path)

    class _ManualContext:
        pass

    context = _ManualContext()
    context.ai_config = {"hf_token": os.getenv("HF_TOKEN")}
    context.storage_paths = storage_paths
    context.captions_trans_path = captions_trans_path
    context.meeting_start = meeting_start
    context.base_id = base_id
    context.meeting_id = meeting_id
    context.session_id = session_id

    log_with_type(
        "info",
        f"Engine(manual > run_diarization) : Running diarization meeting={meeting_id} session={session_id} audio={audio_path}",
        "RUN_MANUAL_DIARIZATION",
    )

    # ==========================================================
    # Run pyannote diarization (model loading + speaker label assignment)
    # ==========================================================

    diarizer = DiarizationEngine(context)

    diarization_data = diarizer.process(
        audio_path,
        whisper_result,
    )

    talk_ratio = TranscriptBuilder.compute_talk_ratio(
        diarization_data
    )

    log_with_type(
        "info",
        f"Engine(manual > run_diarization) : Diarization complete segments={len(diarization_data)} speakers={len(talk_ratio)}",
        "RUN_MANUAL_DIARIZATION",
    )
    # ==========================================================
    # Write output caches (DIAR / RATIO / CAPTIONS)
    # ==========================================================

    diarization_path = TranscriptionCacheManager.save_diarization_output(context, diarization_data)

    talk_ratio_path = os.path.join(
        storage_paths["cache_voice_activity"],
        f"RATIO_{base_id}.json",
    )
    JsonStore.save(talk_ratio_path, talk_ratio)

    captions_raw_path = TranscriptionCacheManager.save_raw_captions(context, diarization_data)

    log_with_type(
        "info",
        f"Engine(manual > run_diarization) : Outputs saved diar={diarization_path} ratio={talk_ratio_path} captions={captions_raw_path}",
        "RUN_MANUAL_DIARIZATION",
    )

    # ==========================================================
    # Persist talk_ratio + speaker segments directly
    # ==========================================================

    persist_diarization(context, talk_ratio, diarization_data)

    return {
        "success": True,
        "meeting_id": meeting_id,
        "session_id": session_id,
        "diarization_path": diarization_path,
        "talk_ratio_path": talk_ratio_path,
        "captions_raw_path": captions_raw_path,
        "speakers": len(talk_ratio),
        "segments": len(diarization_data),
    }


def persist_diarization(context, talk_ratio, diarization_data):
    """Persist talk_ratio + speaker segments to session_diarization directly."""
    meeting_id = context.meeting_id
    session_id = context.session_id

    talk_ratio_json = json.dumps(talk_ratio or {})
    segments_json = json.dumps(diarization_data or [])

    execute(
        """INSERT INTO session_diarization (meeting_id, session_id, talk_ratio, speaker_segments)
           VALUES (%s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE
             meeting_id = VALUES(meeting_id),
             talk_ratio = VALUES(talk_ratio),
             speaker_segments = VALUES(speaker_segments),
             updated_at = CURRENT_TIMESTAMP""",
        (meeting_id, session_id, talk_ratio_json, segments_json),
    )

    log_with_type(
        "info",
        f"Engine(manual > run_diarization) : Persisted session_diarization meeting={meeting_id} session={session_id}",
        "RUN_MANUAL_DIARIZATION",
    )


# ==========================================================
# CLI ENTRY
# ==========================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run on-demand speaker diarization for an already-transcribed meeting."
    )
    parser.add_argument("--meeting_id", required=True, help="Numeric meeting id (meetings.id)")
    parser.add_argument("--session_id", required=True, help="Numeric session id (meeting_sessions.id)")
    parser.add_argument("--audio_path", required=True, help="Absolute or project-relative path to the audio/wav file")
    parser.add_argument("--whisper_path", default=None, help="Optional explicit path to the cached Whisper JSON transcript")

    args = parser.parse_args()

    result = run_manual_diarization(
        meeting_id=args.meeting_id,
        session_id=args.session_id,
        audio_path=args.audio_path,
        whisper_path=args.whisper_path,
    )

    print(json.dumps(result))