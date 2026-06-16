# root/services/engine/task/transcription/transcription_task.py

from utils.logger_util import log_with_type

import os

from services.engine.shared.json_store import (
    JsonStore
)

from services.engine.task.transcription.cache_manager import (
    TranscriptionCacheManager
)

from services.engine.transcription_service.service import (
    TranscriptionService
)


def run_transcription_task(context):

    """
    Full WhisperX transcription pipeline.
    """

    context.mark_task_started(
        "transcription"
    )
    log_with_type("info", "Engine(task > transcription > transcription_task) : Transcription task started", "TASK")

    try:

        service = TranscriptionService(
            context
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : TranscriptionService initialized", "TASK")

        # ==========================================
        # RESOLVE MEETING START FROM CAPTIONS FILE
        # Needed by SpeakerResolver for timestamp
        # alignment inside DiarizationEngine.
        # ==========================================
        if context.captions_trans_path and os.path.exists(context.captions_trans_path):
            context.meeting_start = _parse_meeting_start(context.captions_trans_path)
            log_with_type("info", f"Engine(task > transcription > transcription_task) : Meeting start resolved={context.meeting_start}", "TASK")
        else:
            log_with_type("warning", "Engine(task > transcription > transcription_task) : No captions transcript — speaker names will use SPEAKER_XX labels", "TASK")

        result = service.transcribe(
            context.audio_path
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Transcription completed", "TASK")

        context.transcript_path = (
            result["transcript_path"]
        )

        context.labeled_transcript = (
            result["transcript"]
        )

        context.diarization_data = (
            result["diarization"]
        )

        context.talk_ratio = (
            result["talk_ratio"]
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Context updated with transcript + diarization", "TASK")

        context.whisper_path = (
            TranscriptionCacheManager.save_whisper_output(
                context,
                result["whisper_result"]
            )
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Whisper output cached", "TASK")

        diarization_path = os.path.join(
            context.storage_paths[
                "cache_diarization"
            ],
            f"DIAR_{context.base_id}.json"
        )

        JsonStore.save(
            diarization_path,
            context.diarization_data
        )

        talk_ratio_path = os.path.join(
            context.storage_paths[
                "cache_voice_activity"
            ],
            f"RATIO_{context.base_id}.json"
        )

        JsonStore.save(
            talk_ratio_path,
            context.talk_ratio
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Diarization + talk ratio saved", "TASK")

        context.diarization_path = (
            diarization_path
        )

        context.talk_ratio_path = (
            talk_ratio_path
        )

        context.captions_raw_path = (
            TranscriptionCacheManager.save_raw_captions(
                context,
                context.diarization_data
            )
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Raw captions generated", "TASK")

        JsonStore.save(
            os.path.join(
                context.storage_paths[
                    "cache_chat_logs"
                ],
                f"CHAT_{context.base_id}.json"
            ),
            {
                "messages": [],
                "source": "offline_test_engine",
                "status": "not_captured",
                "reason": "node test-engine.js processes a recording file and does not join a live meeting chat."
            }
        )

        JsonStore.save(
            os.path.join(
                context.storage_paths[
                    "cache_screenshots"
                ],
                f"SCREENSHOTS_{context.base_id}.json"
            ),
            {
                "screenshots": [],
                "source": "offline_test_engine",
                "status": "not_captured",
                "reason": "node test-engine.js does not open a browser session, so no screenshots are produced."
            }
        )

        context.mark_task_completed(
            "transcription"
        )

        log_with_type("info", "Engine(task > transcription > transcription_task) : Transcription task completed", "TASK")

    except Exception:

        context.mark_task_failed(
            "transcription"
        )
        
        log_with_type("error", f"Engine(task > transcription > transcription_task) : Transcription failed error={str(e)}", "TASK")

        raise


# ==========================================
# HELPERS
# ==========================================

def _parse_meeting_start(trans_path):
    """
    Extracts the meeting wall-clock start time from the TRANS_*.txt header.

    Expected header line (all platforms — Teams, Zoom, Google Meet):
        Date       : 6/12/2026, 4:01:53 PM

    Returns a datetime object or None if not found / unparseable.
    """
    import re
    from datetime import datetime

    HEADER_DATE_RE = re.compile(
        r"Date\s*:\s*(\d+/\d+/\d+),?\s+(\d+:\d+:\d+\s+[AP]M)",
        re.IGNORECASE
    )

    try:
        with open(trans_path, encoding="utf-8") as f:
            # Only scan the header — first 20 lines is enough
            for _ in range(20):
                line = f.readline()
                if not line:
                    break
                match = HEADER_DATE_RE.search(line)
                if match:
                    return datetime.strptime(
                        f"{match.group(1)} {match.group(2)}",
                        "%m/%d/%Y %I:%M:%S %p"
                    )
    except Exception:
        pass

    return None