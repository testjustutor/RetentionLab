# services/engine/task/persist_results_task.py

"""
Persist results task.

Runs AFTER summary and audit have completed and persists the
structured results (summary text + diarization talk-ratio + meeting_assets
bookkeeping) into MySQL via database/python_db.py.

Pipeline contract:

    media
      -> transcription
         -> [summary + audit]   (parallel)
         -> persist_results              (this task)
         -> complete

IMPORTANT (FIX): per-indicator rubric persistence (ai_audit_results,
session_rubric_summary) is now handled ONLY by
services/engine/audit_storage.py, called from audit_service.py during the
"audit" task. This file used to ALSO delete+reinsert those same rows in
_persist_audit() with a different (older) scoring/rating derivation, which
ran AFTER audit_task.py and silently overwrote the canonical result with a
second, slightly different computation. That duplicate writer has been
removed. If you need to change rubric persistence, change
audit_storage.py - not this file.
"""

from utils.logger_util import log_with_type

import json

from database.python_db import execute, fetch_one

from services.engine.services.transcript_builder import TranscriptBuilder


def run_persist_results_task(context):
    """Persist structured pipeline results to MySQL."""
    context.mark_task_started("persist_results")
    log_with_type("info", "Engine(task > persist > persist_results_task) : Persist results task started", "TASK")

    try:
        # IMPORTANT: only use the REAL resolved meetings.id (context.meeting_id,
        # set in pipeline_context.py via _resolve_meeting_id()). Do NOT fall
        # back to context.base_id - base_id is a filename-derived string and
        # is never a valid meetings.id.
        meeting_id = context.meeting_id
        session_id = context.session_id

        if not _meeting_exists(meeting_id):
            log_with_type(
                "warning",
                f"Engine(task > persist > persist_results_task) : "
                f"meeting_id={meeting_id!r} is missing or not found in meetings table - "
                f"skipping DB persistence (summary/audit results were still "
                f"computed and are present in the JSON response).",
                "TASK",
            )
            context.mark_task_completed("persist_results")
            return

        # FIX: meeting_assets.session_id is NOT NULL with an FK to
        # meeting_sessions - previously nothing verified session_id was a
        # real row before the INSERT, which would raise an unhandled FK
        # violation whenever context.session_id was None/stale.
        if not _session_exists(session_id):
            log_with_type(
                "warning",
                f"Engine(task > persist > persist_results_task) : "
                f"session_id={session_id!r} is missing or not found in "
                f"meeting_sessions table - skipping DB persistence.",
                "TASK",
            )
            context.mark_task_completed("persist_results")
            return

        summary_data = getattr(context, "summary_data", None) or {}
        audit_results = context.audit_results or {}

        # ONE upsert into meeting_assets covering every column we have data
        # for (audio_path, transcript_path, summary_path, oqi_score,
        # audit_summary, audit_completed_at, video_path, status).
        _persist_meeting_assets(context, meeting_id, session_id, summary_data, audit_results)

        # FIX: talk_ratio used to be JSON-encoded and bound to
        # ai_audit_results.talk_ratio, which is a decimal(5,2) column - that
        # either throws under strict SQL mode or gets silently truncated to
        # 0.00/NULL. talk_ratio has its own dedicated table
        # (session_diarization, longtext columns) that was never written to -
        # write it there instead.
        _persist_diarization(context, meeting_id, session_id)

        log_with_type("info", "Engine(task > persist > persist_results_task) : Persist results task completed", "TASK")
        context.mark_task_completed("persist_results")

    except Exception as e:
        context.mark_task_failed("persist_results")
        log_with_type("error", f"Engine(task > persist > persist_results_task) : Persist results task failed error={str(e)}", "TASK")
        raise


def _meeting_exists(meeting_id):
    """Return True only if meeting_id is a real, existing row in `meetings`.

    Never raises: a DB lookup failure here should not itself crash the
    pipeline - it just means we can't confirm existence, so we treat it
    as "not found" and let the caller skip persistence safely.
    """
    if meeting_id is None:
        return False
    try:
        meeting_id_int = int(meeting_id)
    except (TypeError, ValueError):
        # Non-numeric (e.g. a filename/base_id string) can never be a
        # valid meetings.id - fail fast without hitting the DB.
        return False

    try:
        row = fetch_one("SELECT id FROM meetings WHERE id = %s LIMIT 1", (meeting_id_int,))
        return bool(row)
    except Exception as e:
        log_with_type(
            "warning",
            f"Engine(task > persist > persist_results_task) : "
            f"could not verify meeting_id={meeting_id_int} existence ({e}) - treating as missing",
            "TASK",
        )
        return False


def _session_exists(session_id):
    """Return True only if session_id is a real, existing row in
    `meeting_sessions`. Mirrors _meeting_exists() - never raises."""
    if session_id is None:
        return False
    try:
        session_id_int = int(session_id)
    except (TypeError, ValueError):
        return False

    try:
        row = fetch_one("SELECT id FROM meeting_sessions WHERE id = %s LIMIT 1", (session_id_int,))
        return bool(row)
    except Exception as e:
        log_with_type(
            "warning",
            f"Engine(task > persist > persist_results_task) : "
            f"could not verify session_id={session_id_int} existence ({e}) - treating as missing",
            "TASK",
        )
        return False


def _persist_meeting_assets(context, meeting_id, session_id, summary_data, audit_results):
    """Single upsert into meeting_assets covering ALL of its columns that we
    actually have data for: audio_path, transcript_path, summary_path,
    oqi_score, audit_summary, audit_completed_at, video_path.

    meeting_assets.oqi_score is STILL decimal(5,2) (only ai_audit_results.oqi_score
    became TEXT) - keep this value numeric.
    """
    if not isinstance(summary_data, dict):
        summary_data = {"summary": str(summary_data)}
    summary_text = summary_data.get("summary", "")

    oqi_score = audit_results.get("overall_score") or audit_results.get("oqi_score")
    audit_summary_json = json.dumps(audit_results.get("category_scores") or {}, default=str)

    # FIX: video_path/audit_completed_at were previously left permanently
    # NULL by this task (only pythonBridge.js's MettingAssetController wrote
    # audit_completed_at, and nothing wrote video_path at all). Pull both
    # from context when available so a single writer covers every column.
    video_path = getattr(context, "video_path", None)

    execute(
        """INSERT INTO meeting_assets
           (meeting_id, session_id, audio_path, transcript_path, summary_path,
            video_path, oqi_score, audit_summary, status, audit_completed_at, processed_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'Completed',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE
             audio_path = VALUES(audio_path),
             transcript_path = VALUES(transcript_path),
             summary_path = VALUES(summary_path),
             video_path = COALESCE(VALUES(video_path), video_path),
             oqi_score = VALUES(oqi_score),
             audit_summary = VALUES(audit_summary),
             status = 'Completed',
             audit_completed_at = CURRENT_TIMESTAMP,
             processed_at = CURRENT_TIMESTAMP""",
        (
            meeting_id, session_id,
            getattr(context, "audio_path", None),
            getattr(context, "transcript_path", None),
            getattr(context, "summary_path", None) or f"SUMMARY_{context.base_id}.txt",
            video_path,
            oqi_score,
            audit_summary_json,
        )
    )
    log_with_type(
        "info",
        f"Engine(task > persist) : meeting_assets persisted for meeting={meeting_id} chars={len(summary_text or '')}",
        "TASK",
    )


def _persist_diarization(context, meeting_id, session_id):
    """Write talk-ratio + speaker segments into session_diarization -
    previously computed in memory (transcript_builder.compute_talk_ratio /
    context.diarization_data) but only ever written to files, never to this
    table.

    Both columns are `longtext` so JSON-encoding is correct here (unlike the
    old ai_audit_results.talk_ratio decimal(5,2) column).

    NOTE: in the current DAG flow, transcription_task.py calls
    TranscriptionService.transcribe() (plain text only) and never calls
    .diarize(), so context.diarization_data / context.talk_ratio may still
    be empty at this point. This function persists whatever is available and
    is a no-op (skips cleanly) when both are empty, so wiring up diarization
    later "just works" without touching this file again.
    """
    diarization_data = getattr(context, "diarization_data", None)
    talk_ratio = getattr(context, "talk_ratio", None)

    if not diarization_data and not talk_ratio:
        log_with_type(
            "info",
            "Engine(task > persist) : no diarization/talk_ratio data available - skipping session_diarization",
            "TASK",
        )
        return

    try:
        execute(
            """INSERT INTO session_diarization
               (meeting_id, session_id, talk_ratio, speaker_segments)
               VALUES (%s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                 talk_ratio = VALUES(talk_ratio),
                 speaker_segments = VALUES(speaker_segments),
                 updated_at = CURRENT_TIMESTAMP""",
            (
                meeting_id, session_id,
                json.dumps(talk_ratio or {}, default=str),
                json.dumps(diarization_data or [], default=str),
            )
        )
        log_with_type(
            "info",
            f"Engine(task > persist) : session_diarization persisted for meeting={meeting_id} session={session_id}",
            "TASK",
        )
    except Exception as e:
        log_with_type(
            "warning",
            f"Engine(task > persist) : failed to persist session_diarization -> {e}",
            "TASK",
        )