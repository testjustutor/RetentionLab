# services/engine/services/summary.py

from services.engine.services.summary_worker import (
    SummaryWorker
)


class SummaryService:

    """
    Non-AI summary service (AI removed - single-AI-call policy).
    """

    def __init__(
        self
    ):

        self.worker = SummaryWorker()

    # ==========================================
    # GENERATE
    # ==========================================

    def generate(
        self,
        transcript
    ):

        return self.worker.generate(transcript)
