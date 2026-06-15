# services/engine/ai_api_service/service.py
from services.engine.ai_api_service.api_worker import AiApiService


class AIAPIService:
    """
    LLM API wrapper.
    """
    def __init__(self, ai_config):
        self.worker = AiApiService(ai_config)

    def ask_ai(self, prompt, system_instruction="You are a helpful assistant."):
        return self.worker.ask_ai(prompt, system_instruction)