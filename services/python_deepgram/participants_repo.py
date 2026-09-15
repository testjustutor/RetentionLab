"""
services/python_deepgram/participants_repo.py

Persists the tutor/instructor and student names detected for a recording
into the shared `participants` table (see database/migrations/030_create_
participants_table.js and models/participants/ParticipantModel.js).

Design notes / why this looks the way it does:

- `participants` already gets a row per attendee the moment they join the
  live call - models/participants/ParticipantModel.js's
  recordParticipantJoin(), keyed on the platform's own display name for
  that meeting_id + session_id. This module does NOT replace that path; it
  runs after transcription, once a name has been recovered from the
  filename (teacher) and/or the transcript (student - see
  name_detector.detect_student_name), and UPSERTs by the table's existing
  UNIQUE KEY (meeting_id, session_id, participant_name):
    - if a live-join row already exists under that exact name, this only
      backfills participant_role - no code path in ParticipantModel.js
      ever sets participant_role, so it's otherwise left NULL forever;
    - otherwise it inserts a fresh row, so a name recovered purely from the
      recording (no join event captured - e.g. a student who dialed in and
      the bot's join-tracking missed it) still ends up recorded.

- Role values are the literal "Tutor"/"Student" strings already used
  everywhere else in this service (transcriber.TUTOR_STUDENT, and every
  segment's "speaker" field) - not re-spelled as lowercase/"teacher"/etc,
  so participant_role lines up 1:1 with transcript speaker labels for
  anyone cross-referencing the two.

- Goes through database/python_db.py - the project's shared MySQL
  connection pool + query helpers - the same low-level access point
  models/python/python_session_scores_model.py already uses for Python-side
  writes, using the same INSERT ... ON DUPLICATE KEY UPDATE style.

- Never raises. This is a best-effort enrichment step bolted onto the
  transcription pipeline: a missing DB, a closed pool, a schema drift -
  none of it should fail the transcription job that's calling it. Every
  failure is caught, logged, and reported back in the returned dict's
  "error" field instead.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from utils.logger_util import log_with_type

# Kept identical to transcriber.TUTOR_STUDENT / the "speaker" field written
# onto every segment - see the module docstring above.
ROLE_TUTOR = "Tutor"
ROLE_STUDENT = "Student"

_UPSERT_SQL = """
    INSERT INTO participants (
        meeting_id, session_id, participant_name, participant_role,
        created_at, updated_at
    ) VALUES (%s, %s, %s, %s, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
        participant_role = VALUES(participant_role),
        updated_at = NOW()
"""


def _upsert_one(meeting_id: int, session_id: int, name: str, role: str) -> None:
    # Imported lazily so a missing/misconfigured mysql-connector install
    # (or DB env vars) only breaks this best-effort enrichment step, never
    # the rest of the isolated python_deepgram module at import time.
    from database.python_db import execute
    execute(_UPSERT_SQL, (meeting_id, session_id, name.strip(), role))


def save_participants(
    meeting_id: Optional[int],
    session_id: Optional[int],
    teacher_name: Optional[str],
    student_name: Optional[str],
) -> Dict[str, Any]:
    """Best-effort UPSERT of the detected teacher/student names into the
    `participants` table.

    Silently no-ops (with a log line, not an error) when meeting_id/
    session_id aren't available - both columns are NOT NULL with FK
    constraints onto meetings/meeting_sessions, so there's nothing safe to
    write without them. See transcribe_and_save()'s meeting_id/session_id
    params and its REC_/SCREEN_ filename auto-derivation.

    Returns {"attempted": bool, "saved": [<"teacher"|"student">, ...],
    "error": str|None}.
    """
    result: Dict[str, Any] = {"attempted": False, "saved": [], "error": None}

    if meeting_id is None or session_id is None:
        log_with_type(
            "info",
            "participants_repo: skipping DB write - meeting_id/session_id not available "
            f"(teacher_name={teacher_name!r}, student_name={student_name!r} still returned in the result)",
            "PYTHON_DEEPGRAM",
        )
        return result

    result["attempted"] = True
    try:
        if teacher_name:
            _upsert_one(meeting_id, session_id, teacher_name, ROLE_TUTOR)
            result["saved"].append("teacher")
        if student_name:
            _upsert_one(meeting_id, session_id, student_name, ROLE_STUDENT)
            result["saved"].append("student")

        log_with_type(
            "info",
            f"participants_repo: saved {result['saved'] or '[]'} -> participants "
            f"(meeting_id={meeting_id}, session_id={session_id})",
            "PYTHON_DEEPGRAM",
        )
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        log_with_type(
            "error",
            f"participants_repo: DB write failed ({result['error']}) - continuing without it",
            "PYTHON_DEEPGRAM",
        )
    return result
