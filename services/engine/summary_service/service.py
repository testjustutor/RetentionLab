from services.engine.summary_service.summary_worker import (
    SummaryWorker,
    SummaryService as AISummaryService
)
from services.shared.ai_config import load_settings_ai, build_ai_config


class SummaryService:

    """
    AI summary wrapper service.
    """

    def __init__(
        self
    ):

        self.worker = SummaryWorker()
        self.ai_worker = None

        try:
            ai_settings = load_settings_ai()
        except Exception:
            ai_settings = {}

        ai_config = build_ai_config(ai_settings)

        if ai_config:
            self.ai_worker = AISummaryService(ai_config)

    # ==========================================
    # GENERATE
    # ==========================================

    def generate(
        self,
        transcript
    ):

        if self.ai_worker:
            try:
                ai_summary = self.ai_worker.generate_meeting_summary(
                    transcript
                )
                if ai_summary:
                    return ai_summary
            except Exception:
                pass

        return self.worker.generate(transcript)