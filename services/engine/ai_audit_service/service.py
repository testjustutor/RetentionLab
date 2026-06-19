# root/services/engine/ai_audit_service/service.py
import os
import traceback
from services.engine.ai_audit_service.audit_worker import AuditWorker, AiAuditService
from services.shared.ai_config import load_settings_ai, build_ai_config

class AuditService:
    """
    AI audit wrapper service.
    """
    def __init__(self):
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
                    "..", "..", "..",
                    "retention_lab.db"
                )
            )
            if not os.path.exists(db_path):
                raise FileNotFoundError(
                    f"[AuditService] Database not found at resolved path: {db_path}"
                )
            self.ai_worker = AiAuditService(db_path, ai_config)

    # ==========================================
    # EVALUATE
    # ==========================================
    def evaluate(self, transcript, talk_ratio, meeting_id=None, session_id=None):
        if self.ai_worker:
            try:
                ai_result = self.ai_worker.process_audit(
                    transcript,
                    meeting_id=meeting_id,
                    session_id=session_id,
                    talk_ratio=talk_ratio
                )
                if isinstance(ai_result, dict):
                    ai_result["talk_ratio"] = talk_ratio or {}
                    return ai_result
            except Exception as e:
                print(f"[AuditService] AI audit failed: {e}")
                traceback.print_exc()
        return self.worker.evaluate(transcript, talk_ratio)

    # ==========================================
    # RUN AUDIT (called by audit_bridge.py)
    # ==========================================
    def run_audit(self, transcript_text, meeting_id=None, session_id=None, talk_ratio=None):
        """
        Main entry point called by audit_bridge.py.
        Runs AI audit against the transcript using the rubric,
        stores per-indicator results in the database, and returns the report.
        """
        if self.ai_worker:
            try:
                ai_result = self.ai_worker.process_audit(
                    transcript_text,
                    meeting_id=meeting_id,
                    session_id=session_id,
                    talk_ratio=talk_ratio
                )
                if isinstance(ai_result, dict):
                    return ai_result
            except Exception as e:
                print(f"[AuditService] AI audit failed: {e}")
                traceback.print_exc()
        # Fallback to rule-based evaluation
        return self.worker.evaluate(transcript_text, talk_ratio=talk_ratio)