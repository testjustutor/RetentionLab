from services.engine.ai_api_service.api_worker import (
    APIWorker
)


class AIAPIService:

    """
    LLM API wrapper.
    """

    def __init__(
        self
    ):

        self.worker = APIWorker()

    # ==========================================
    # REQUEST
    # ==========================================

    def request(
        self,
        payload
    ):

        return self.worker.request(
            payload
        )