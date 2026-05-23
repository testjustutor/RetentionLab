from services.engine.shared.json_store import (
    JsonStore
)


class PipelineAuditLogger:

    """
    Stores pipeline execution reports.
    """

    @staticmethod
    def save(
        path,
        payload
    ):

        JsonStore.save(
            path,
            payload
        )