# services/engine/services/api_worker.py
import os
import json
import urllib.request
import urllib.error
from openai import OpenAI

class AiApiService:
    def __init__(self, ai_config):
        self.config = ai_config
        self.provider = ai_config["provider"].lower()
        self.client = self._init_client()

    def _init_client(self):
        if self.provider == "anthropic":
            # Anthropic is called directly over HTTP (no SDK installed), so no
            # client object is built here. See ask_ai() for the request path.
            return None
        if self.provider == "cloude":
            return OpenAI(
                api_key=self.config.get("cloudeApiKey"),
                base_url="https://api.cloude.com/openai/v1"
            )
        elif self.provider == "gemini":
            from google import genai
            return genai.Client(api_key=self.config.get("geminiApiKey"))
        elif self.provider == "ollama":
            return OpenAI(
                api_key="ollama",
                base_url=self.config.get("ollamaUrl")
            )
        else:
            return OpenAI(api_key=self.config.get("openaiApiKey"))

    @property
    def model(self):
        """
        Resolve the model name actually used for the active provider.
        Useful for recording the exact request/response metadata.
        """
        if self.provider == "anthropic":
            return self.config.get("anthropicModel")
        if self.provider == "gemini":
            return self.config.get("geminiModel")
        model_map = {
            "cloude": self.config.get("cloudeModel"),
            "openai": self.config.get("openaiModel"),
            "ollama": self.config.get("ollamaModel")
        }
        return model_map.get(self.provider)

    def _ask_anthropic(self, prompt, system_instruction):
        """Direct Anthropic Messages API call via stdlib urllib (no SDK)."""
        api_key = self.config.get("anthropicApiKey")
        if not api_key:
            raise RuntimeError("AI Provider error: anthropicApiKey not configured")
        url = "https://api.anthropic.com/v1/messages"
        payload = {
            "model": self.config.get("anthropicModel"),
            "max_tokens": int(self.config.get("anthropicMaxTokens") or 1024),
            "system": system_instruction,
            "messages": [{"role": "user", "content": prompt}],
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise RuntimeError(
                f"AI Provider error: anthropic HTTP {e.code}: "
                f"{e.read().decode('utf-8', errors='replace')[:500]}"
            )
        except urllib.error.URLError as e:
            raise RuntimeError(f"AI Provider error: anthropic connection failed: {e.reason}")

        # Anthropic returns content as a list of text blocks.
        content = body.get("content") or []
        text = "".join(
            block.get("text", "") for block in content if isinstance(block, dict)
        ).strip()
        if not text:
            raise RuntimeError("AI Provider error: anthropic returned empty text")
        return text

    def ask_ai(self, prompt, system_instruction="You are a helpful assistant."):
        try:
            if self.provider == "anthropic":
                return self._ask_anthropic(prompt, system_instruction)

            if self.provider == "gemini":
                full_prompt = f"{system_instruction}\n\n{prompt}"
                response = self.client.models.generate_content(
                    model=self.config.get("geminiModel"),
                    contents=full_prompt
                )

                return response.text

            model_map = {
                "cloude": self.config.get("cloudeModel"),
                "openai": self.config.get("openaiModel"),
                "ollama": self.config.get("ollamaModel")
            }

            response = self.client.chat.completions.create(
                model=model_map.get(self.provider),
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            raise RuntimeError(f"AI Provider error: {str(e)}")