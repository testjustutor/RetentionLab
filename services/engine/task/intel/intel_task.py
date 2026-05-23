import os
import hashlib

from services.engine.transcription_service.embedding_engine import (
    EmbeddingEngine
)

from services.engine.shared.json_store import (
    JsonStore
)

from services.engine.voiceprints.voiceprint_builder import (
    VoiceprintBuilder
)


def run_intel_task(context):

    """
    Intelligence extraction task.

    Handles:
    - embeddings
    - semantic vectors
    - transcript intelligence
    """

    context.mark_task_started(
        "intel"
    )

    try:

        print(
            "\n[INTEL TASK] Starting...",
            flush=True
        )

        engine = EmbeddingEngine(
            context
        )

        embeddings = engine.generate(
            context.labeled_transcript
        )

        output_path = os.path.join(

            context.storage_paths[
                "cache_embeddings"
            ],

            f"EMBEDDINGS_{context.base_id}.json"
        )

        JsonStore.save(
            output_path,
            embeddings
        )

        context.vector_path = (
            output_path
        )

        context.intel[
            "vectors"
        ] = embeddings

        voiceprint_builder = VoiceprintBuilder(
            context
        )

        voiceprint_paths = {}

        for speaker in (
            context.talk_ratio or {}
        ):

            digest = hashlib.sha256(
                f"{speaker}:{context.labeled_transcript}".encode(
                    "utf-8"
                )
            ).digest()

            voiceprint_paths[
                speaker
            ] = voiceprint_builder.build(
                speaker.replace(" ", "_"),
                [
                    round(byte / 255, 6)
                    for byte in digest[:32]
                ]
            )

        intel_path = os.path.join(

            context.storage_paths[
                "intel"
            ],

            f"INTEL_{context.base_id}.json"
        )

        JsonStore.save(
            intel_path,
            {
                "base_id": context.base_id,
                "embedding_path": output_path,
                "voiceprint_paths": voiceprint_paths,
                "talk_ratio": context.talk_ratio or {},
                "topics": context.intel.get("topics"),
                "sentiment": context.intel.get("sentiment")
            }
        )

        context.intel_path = (
            intel_path
        )

        context.mark_task_completed(
            "intel"
        )

        print(
            "[INTEL TASK] Completed.\n",
            flush=True
        )

    except Exception:

        context.mark_task_failed(
            "intel"
        )

        raise
