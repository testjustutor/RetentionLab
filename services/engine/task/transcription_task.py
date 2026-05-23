import os
import json

from services.engine.transcription_service import (
    TranscriptionService
)


def run_transcription_task(context):

    """
    Handles:
    - whisperx transcription
    - diarization generation
    - transcript caching
    - talk ratio generation
    """

    context.mark_task_started(
        "transcription"
    )

    try:

        print(
            "\n"
            + "=" * 65,
            flush=True
        )

        print(
            "[TRANSCRIPTION TASK] Starting AI speech pipeline...",
            flush=True
        )

        print(
            "=" * 65 + "\n",
            flush=True
        )

        # ==========================================
        # TRANSCRIPTION EXECUTION
        # ==========================================

        service = TranscriptionService(
            hf_token=os.getenv(
                "HF_TOKEN"
            )
        )

        (
            labeled_transcript,
            talk_ratio,
            diarization_data
        ) = service.process(
            context.audio_path
        )

        # ==========================================
        # STORE CONTEXT
        # ==========================================

        context.labeled_transcript = (
            labeled_transcript
        )

        context.talk_ratio = (
            talk_ratio
        )

        context.diarization_data = (
            diarization_data
        )

        # ==========================================
        # TRANSCRIPT OUTPUT
        # ==========================================

        transcript_path = os.path.join(

            context.storage_paths[
                "transcripts"
            ],

            f"TRANS_{context.base_id}.txt"
        )

        with open(
            transcript_path,
            "w",
            encoding="utf-8"
        ) as file:

            file.write(
                labeled_transcript
            )

        context.transcript_path = (
            transcript_path
        )

        # ==========================================
        # DIARIZATION CACHE
        # ==========================================

        diarization_path = os.path.join(

            context.storage_paths[
                "cache_diarization"
            ],

            f"DIAR_{context.base_id}.json"
        )

        with open(
            diarization_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                diarization_data,
                file,
                indent=4
            )

        # ==========================================
        # TALK RATIO CACHE
        # ==========================================

        talk_ratio_path = os.path.join(

            context.storage_paths[
                "cache_voice_activity"
            ],

            f"TALK_RATIO_{context.base_id}.json"
        )

        with open(
            talk_ratio_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                talk_ratio,
                file,
                indent=4
            )

        context.mark_task_completed(
            "transcription"
        )

        print(
            "[TRANSCRIPTION TASK] AI transcription completed.\n",
            flush=True
        )

    except Exception:

        context.mark_task_failed(
            "transcription"
        )

        raise