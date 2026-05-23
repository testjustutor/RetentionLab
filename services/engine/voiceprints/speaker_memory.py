import os

from services.engine.shared.json_store import (
    JsonStore
)


class SpeakerMemory:

    """
    Loads persistent voiceprints.
    """

    @staticmethod
    def load_all(
        directory
    ):

        speakers = []

        if not os.path.exists(
            directory
        ):

            return speakers

        for file_name in os.listdir(
            directory
        ):

            if not file_name.endswith(
                ".json"
            ):

                continue

            path = os.path.join(
                directory,
                file_name
            )

            try:

                speakers.append(

                    JsonStore.load(path)
                )

            except Exception:

                continue

        return speakers