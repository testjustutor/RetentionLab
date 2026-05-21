def run_media_task(context):
    from services.engine.task.media.media_task import run_media_task as handler
    return handler(context)


def run_transcription_task(context):
    from services.engine.task.transcription.transcription_task import (
        run_transcription_task as handler
    )
    return handler(context)


def run_intel_task(context):
    from services.engine.task.intel.intel_task import run_intel_task as handler
    return handler(context)


def run_audit_task(context):
    from services.engine.task.audit.audit_task import run_audit_task as handler
    return handler(context)


def run_summary_task(context):
    from services.engine.task.summary.summary_task import run_summary_task as handler
    return handler(context)


def run_topics_task(context):
    from services.engine.task.topics.topics_task import run_topics_task as handler
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
    # INTEL
    # ==========================================

    "intel": {

        "handler": run_intel_task,

        "dependencies": [
            "transcription"
        ],

        "parallel": True,

        "feature_flag": (
            "enable_intel"
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
    # TOPICS
    # ==========================================

    "topics": {

        "handler": (
            run_topics_task
        ),

        "dependencies": [
            "transcription"
        ],

        "parallel": True,

        "feature_flag": (
            "enable_topics"
        )
    }
}
