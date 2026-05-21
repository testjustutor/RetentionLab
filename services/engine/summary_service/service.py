from services.engine.summary_service.summary_worker import (
    SummaryWorker
)


class SummaryService:

    """
    AI summary wrapper service.
    """

    def __init__(
        self
    ):

        self.worker = (
            SummaryWorker()
        )

    # ==========================================
    # GENERATE
    # ==========================================

    def generate(
        self,
        transcript
    ):

        return self.worker.generate(
            transcript
        )