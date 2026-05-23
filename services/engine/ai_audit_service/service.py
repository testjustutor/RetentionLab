from services.engine.ai_audit_service.audit_worker import (
    AuditWorker,
    AiAuditService
)
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

        groq_key = os.getenv("GROQ_API_KEY")
        provider = os.getenv("AI_PROVIDER", "groq").lower()

        if groq_key:
            ai_config = {
                "provider": provider,
                "groqApiKey": groq_key,
                "openaiApiKey": os.getenv("OPENAI_API_KEY"),
                "xaiApiKey": os.getenv("XAI_API_KEY"),
                "ollamaUrl": os.getenv("OLLAMA_URL", "http://localhost:11434/v1"),
                "ollamaModel": os.getenv("OLLAMA_MODEL", "llama3.1"),
                "geminiApiKey": os.getenv("GEMINI_API_KEY"),
                "geminiModel": os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
            }

            db_path = os.path.abspath(
                os.path.join(
                    os.path.dirname(__file__),
                    "..",
                    "..",
                    "..",
                    "retention_lab.db"
                )
            )

            self.ai_worker = AiAuditService(
                db_path,
                ai_config
            )

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
