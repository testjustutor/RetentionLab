#  root/services/engine/ai_audit_service/service.py
from services.engine.ai_audit_service.audit_worker import (
    AuditWorker,
    AiAuditService
)
from services.shared.ai_config import load_settings_ai, build_ai_config
import os


class AuditService:

    """
    AI audit wrapper service.
    """

    def __init__(
        self
    ):

        self.worker = AuditWorker()
        self.ai_worker = None

        try:
            ai_settings = load_settings_ai()
        except Exception:
            ai_settings = {}

        ai_config = build_ai_config(ai_settings)

        if ai_config:
            db_path = os.path.abspath(
                os.path.join(
                    os.path.dirname(__file__),
                    "..",
                    "..",
                    "..",
                    "retention_lab.db"
                )
            )
            self.ai_worker = AiAuditService(db_path, ai_config)

    # ==========================================
    # EVALUATE
    # ==========================================

    def evaluate(
        self,
        transcript,
        talk_ratio
    ):

        if self.ai_worker:
            try:
                ai_result = self.ai_worker.process_audit(
                    transcript
                )

                if isinstance(ai_result, dict):
                    ai_result["talk_ratio"] = talk_ratio or {}
                    return ai_result
            except Exception:
                pass

        return self.worker.evaluate(
            transcript,
            talk_ratio
        )