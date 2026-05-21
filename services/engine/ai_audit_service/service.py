from services.engine.ai_audit_service.audit_worker import (
    AuditWorker
)


class AuditService:

    """
    AI audit wrapper service.
    """

    def __init__(
        self
    ):

        self.worker = AuditWorker()

    # ==========================================
    # EVALUATE
    # ==========================================

    def evaluate(
        self,
        transcript,
        talk_ratio
    ):

        return self.worker.evaluate(

            transcript,

            talk_ratio
        )