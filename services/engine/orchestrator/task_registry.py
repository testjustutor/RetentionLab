# services/engine/orchestrator/task_registry.py

from utils.logger_util import log_with_type

def run_media_task(context):
    log_with_type("info", "Engine(orchestrator > task_registry) : run_media_task dispatched", "TASK")
    from services.engine.task.media_task import run_media_task as handler
    return handler(context)


def run_transcription_task(context):
    log_with_type("info", "Engine(orchestrator > task_registry) : run_transcription_task dispatched", "TASK")
    from services.engine.task.transcription_task import (
        run_transcription_task as handler
    )
    return handler(context)


def run_audit_task(context):
    log_with_type("info", "Engine(orchestrator > task_registry) : run_audit_task dispatched", "TASK")
    from services.engine.task.audit_task import run_audit_task as handler
    return handler(context)


def run_summary_task(context):
    log_with_type("info", "Engine(orchestrator > task_registry) : run_summary_task dispatched", "TASK")
    from services.engine.task.summary_task import run_summary_task as handler
    return handler(context)


def run_tutor_eval_task(context):
    log_with_type("info", "Engine(orchestrator > task_registry) : run_tutor_eval_task dispatched", "TASK")
    from services.engine.task.tutor_eval_task import run_tutor_eval_task as handler
    return handler(context)


def run_persist_results_task(context):
    log_with_type("info", "Engine(orchestrator > task_registry) : run_persist_results_task dispatched", "TASK")
    from services.engine.task.persist_results_task import run_persist_results_task as handler
    return handler(context)


TASK_REGISTRY = {

    # ==========================================
    # MEDIA
    # ==========================================

    "media": {
        "handler": run_media_task,
        "dependencies": [],
        "parallel": False,
        "feature_flag": (
            "enable_media"
        )
    },

    # ==========================================
    # TRANSCRIPTION
    # ==========================================

    "transcription": {
        "handler": (
            run_transcription_task
        ),
        "dependencies": [
            "media"
        ],
        "parallel": False,
        "feature_flag": (
            "enable_transcription"
        )
    },

    # ==========================================
    # AUDIT
    # ==========================================

    "audit": {
        "handler": run_audit_task,
        "dependencies": [
            "transcription"
        ],
        "parallel": True,
        "feature_flag": (
            "enable_audit"
        )
    },

    # ==========================================
    # SUMMARY
    # ==========================================

    "summary": {
        "handler": (
            run_summary_task
        ),
        "dependencies": [
            "transcription"
        ],
        "parallel": True,
        "feature_flag": (
            "enable_summary"
        )
    },

    # ==========================================
    # TUTOR EVAL
    # Depends on "audit" (not just "transcription") so it never runs
    # concurrently with audit_task.py - both write to ai_audit_results
    # for the same (meeting_id, session_id) via DELETE-then-INSERT, and
    # running them in the same parallel batch would race/corrupt that
    # table. Still runs in parallel with "summary" (unrelated table).
    # ==========================================

    "tutor_eval": {
        "handler": run_tutor_eval_task,
        "dependencies": [
            "transcription",
            "audit"
        ],
        "parallel": True,
        "feature_flag": (
            "enable_tutor_eval"
        )
    },

    # ==========================================
    # PERSIST RESULTS
    # Runs after summary/audit have all
    # produced their outputs. Persists structured
    # results (summary + rubric + metrics) to MySQL.
    # ==========================================

    "persist_results": {
        "handler": (
            run_persist_results_task
        ),
        "dependencies": [
            "summary",
            "audit"
        ],
        "parallel": False,
        "feature_flag": (
            "enable_persist_results"
        )
    }
}