# services/engine/ai_api_service/api_worker.py
import os
from openai import OpenAI

class AiApiService:
    def __init__(self, ai_config):
        self.config = ai_config
        self.provider = ai_config["provider"].lower()
        self.client = self._init_client()

    def _init_client(self):
        if self.provider == "cloude":
            return OpenAI(
                api_key=self.config.get("cloudeApiKey"),
                base_url="https://api.cloude.com/openai/v1"
            )
        elif self.provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=self.config.get("geminiApiKey"))
            return genai.GenerativeModel(self.config.get("geminiModel"))
        elif self.provider == "ollama":
            return OpenAI(
                api_key="ollama",
                base_url=self.config.get("ollamaUrl")
            )
        else:
            return OpenAI(api_key=self.config.get("openaiApiKey"))

    def ask_ai(self, prompt, system_instruction="You are a helpful assistant."):
        try:
            if self.provider == "gemini":
                full_prompt = f"{system_instruction}\n\n{prompt}"
                response = self.client.generate_content(full_prompt)
                return response.text

            model_map = {
                "cloude": self.config.get("cloudeModel", "llama-3.1-8b-instant"),
                "openai": self.config.get("openaiModel"),
                "ollama": self.config.get("ollamaModel")
            }

            response = self.client.chat.completions.create(
                model=model_map.get(self.provider, "gpt-4o-mini"),
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            raise RuntimeError(f"AI Provider error: {str(e)}")