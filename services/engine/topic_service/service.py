from services.engine.topic_service.topic_worker import (
    TopicWorker
)


class TopicService:

    """
    Topic extraction wrapper.
    """

    def __init__(
        self
    ):

        self.worker = TopicWorker()

    # ==========================================
    # EXTRACT
    # ==========================================

    def extract_topics(
        self,
        transcript
    ):

        return self.worker.extract_topics(
            transcript
        )