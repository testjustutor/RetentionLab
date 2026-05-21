from services.engine.summary_service.summary_worker import (
    SummaryWorker,
    SummaryService as AISummaryService
)
import os


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
            self.ai_worker = AISummaryService(
                ai_config
            )

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
