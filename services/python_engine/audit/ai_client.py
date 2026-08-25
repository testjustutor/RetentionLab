"""
services/python_engine/audit/ai_client.py

ISOLATED AI provider client for the python_engine audit. Reads provider
credentials from the environment (root .env via python-dotenv) and calls the
active provider (anthropic / gemini / openai / ollama). No dependency on
services/engine or services/shared.

Exposes a single method `ask_ai(prompt, system_instruction)` returning the
model's raw text, plus `provider`/`model` for metadata.
"""
import os
import json
import urllib.request
import urllib.error

try:
    from dotenv import load_dotenv
    load_dotenv()  # loads root .env (project root on PYTHONPATH)
except Exception:
    pass

from utils.logger_util import log_with_type


class AiClient:
    def __init__(self):
        self.provider = (os.getenv("AI_PROVIDER") or "openai").lower()
        self.model = self._resolve_model()
        log_with_type("info", f"audit/ai_client: provider={self.provider} model={self.model}", "PYTHON_ENGINE")

    def _resolve_model(self):
        key = {
            "anthropic": "ANTHROPIC_MODEL",
            "gemini": "GEMINI_MODEL",
            "openai": "OPENAI_MODEL",
            "ollama": "OLLAMA_MODEL",
        }.get(self.provider)
        return os.getenv(key) or (os.getenv("OLLAMA_MODEL") if self.provider == "ollama" else "")

    def _ask_anthropic(self, prompt, system_instruction):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not configured")
        url = "https://api.anthropic.com/v1/messages"
        payload = {
            "model": self.model,
            "max_tokens": int(os.getenv("ANTHROPIC_MAX_TOKENS", "1024")),
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
            raise RuntimeError(f"anthropic HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:500]}")
        except urllib.error.URLError as e:
            raise RuntimeError(f"anthropic connection failed: {e.reason}")
        content = body.get("content") or []
        text = "".join(b.get("text", "") for b in content if isinstance(b, dict)).strip()
        if not text:
            raise RuntimeError("anthropic returned empty text")
        return text

    def _ask_gemini(self, prompt, system_instruction):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not configured")
        full_prompt = f"{system_instruction}\n\n{prompt}"
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model=self.model, contents=full_prompt)
        return response.text

    def _ask_openai_like(self, prompt, system_instruction):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not configured")
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content

    def _ask_ollama(self, prompt, system_instruction):
        from openai import OpenAI
        base_url = os.getenv("OLLAMA_URL", "http://localhost:11434/v1")
        client = OpenAI(api_key="ollama", base_url=base_url)
        response = client.chat.completions.create(
            model=self.model or "llama3.3",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content

    def ask_ai(self, prompt, system_instruction="You are a helpful assistant."):
        log_with_type("info", f"audit/ai_client: calling {self.provider}", "PYTHON_ENGINE")
        try:
            if self.provider == "anthropic":
                return self._ask_anthropic(prompt, system_instruction)
            if self.provider == "gemini":
                return self._ask_gemini(prompt, system_instruction)
            if self.provider == "ollama":
                return self._ask_ollama(prompt, system_instruction)
            return self._ask_openai_like(prompt, system_instruction)
        except Exception as e:
            log_with_type("error", f"audit/ai_client: {self.provider} call failed -> {e}", "PYTHON_ENGINE")
            raise RuntimeError(f"AI Provider error: {str(e)}")