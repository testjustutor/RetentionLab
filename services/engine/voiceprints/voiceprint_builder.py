from services.engine.shared.json_store import (
    JsonStore
)

import os


class VoiceprintBuilder:

    """
    Builds persistent speaker embeddings.
    """

    def __init__(
        self,
        context
    ):

        self.context = context

    # ==========================================
    # BUILD
    # ==========================================

    def build(
        self,
        speaker_id,
        embedding
    ):

        output_path = os.path.join(

            self.context.storage_paths[
                "cache_voiceprints"
            ],

            f"{speaker_id}.json"
        )

        JsonStore.save(

            output_path,

            {
                "speaker_id": speaker_id,
                "embedding": embedding
            }
        )

        return output_path