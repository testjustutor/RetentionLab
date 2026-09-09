"""
services/engine/ai_client.py

AI provider client for the consolidated python_engine audit. Reads provider
credentials from the environment (root .env via python-dotenv) and calls the
active provider (anthropic / gemini / openai / ollama).

Exposes a single method `ask_ai(prompt, system_instruction)` returning the
model's raw text, plus `provider`/`model` for metadata.
"""
import os
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as _FutureTimeout

try:
    from dotenv import load_dotenv
    load_dotenv()  # loads root .env (project root on PYTHONPATH)
except Exception:
    pass

from utils.logger_util import log_with_type

# Hard ceiling for ONE AI provider call. Some SDK paths (e.g. google-genai)
# have no built-in timeout and can hang forever on network issues -> without
# this watchdog the whole pipeline stalls at "Running AI audit".
AI_CALL_TIMEOUT = int(os.getenv("AI_CALL_TIMEOUT", "180"))


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

    @staticmethod
    def _gemini_api_keys():
        """Ordered list of (label, key) for every configured Gemini key:
        GEMINI_API_KEY, then GEMINI_API_KEY1, GEMINI_API_KEY2, ... GEMINI_API_KEY9
        (only the ones actually set in .env). Lets a transient failure on one
        key (rate limit, quota, temporary "model overloaded" 503, revoked key)
        retry on the next key instead of failing the whole audit/summary/
        tutor-eval task."""
        pairs = []
        primary = os.getenv("GEMINI_API_KEY")
        if primary:
            pairs.append(("GEMINI_API_KEY", primary))
        for i in range(1, 10):
            key = os.getenv(f"GEMINI_API_KEY{i}")
            if key:
                pairs.append((f"GEMINI_API_KEY{i}", key))
        return pairs

    def _ask_gemini_with_key(self, api_key, prompt, system_instruction):
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

    def _build_attempts(self, prompt, system_instruction):
        """Ordered list of (label, zero-arg callable) to try for this call.

        Only 'gemini' gets multi-key rotation + an automatic provider
        fallback to OpenAI once every configured Gemini key has failed -
        anthropic/openai/ollama run exactly as before (a single attempt),
        since only Gemini keys + an OpenAI fallback were asked for.
        """
        if self.provider == "gemini":
            gemini_keys = self._gemini_api_keys()
            if not gemini_keys:
                raise RuntimeError("GEMINI_API_KEY not configured")

            attempts = [
                (
                    f"gemini ({label})",
                    (lambda k=key: self._ask_gemini_with_key(k, prompt, system_instruction)),
                )
                for label, key in gemini_keys
            ]

            if os.getenv("OPENAI_API_KEY"):
                attempts.append((
                    "openai (fallback after all Gemini keys failed)",
                    (lambda: self._ask_openai_like(prompt, system_instruction)),
                ))
            return attempts

        if self.provider == "anthropic":
            return [("anthropic", lambda: self._ask_anthropic(prompt, system_instruction))]
        if self.provider == "ollama":
            return [("ollama", lambda: self._ask_ollama(prompt, system_instruction))]
        return [("openai", lambda: self._ask_openai_like(prompt, system_instruction))]

    def ask_ai(self, prompt, system_instruction="You are a helpful assistant."):
        attempts = self._build_attempts(prompt, system_instruction)
        last_err = None

        for label, fn in attempts:
            log_with_type("info", f"audit/ai_client: calling {label}", "PYTHON_ENGINE")

            # Watchdog: never let ONE attempt hang the pipeline. Each key/
            # provider gets its own timeout so a hang on key #1 doesn't cost
            # key #2 its own chance - only a genuine failure/timeout moves on
            # to the next attempt.
            executor = ThreadPoolExecutor(max_workers=1)
            try:
                future = executor.submit(fn)
                try:
                    result = future.result(timeout=AI_CALL_TIMEOUT)
                    log_with_type("info", f"audit/ai_client: {label} responded OK", "PYTHON_ENGINE")
                    return result
                except _FutureTimeout:
                    last_err = RuntimeError(f"{label} did not respond within {AI_CALL_TIMEOUT}s")
                    log_with_type(
                        "warning",
                        f"audit/ai_client: {label} timed out after {AI_CALL_TIMEOUT}s "
                        f"(model={self.model}) - trying next option if available",
                        "PYTHON_ENGINE",
                    )
                except Exception as e:
                    last_err = e
                    log_with_type(
                        "warning",
                        f"audit/ai_client: {label} failed -> {e} - trying next option if available",
                        "PYTHON_ENGINE",
                    )
            finally:
                # Do NOT wait for the orphaned request thread; it will finish/die on its own.
                executor.shutdown(wait=False)

        log_with_type("error", f"audit/ai_client: all providers/keys exhausted -> {last_err}", "PYTHON_ENGINE")
        raise RuntimeError(f"AI Provider error: all providers/keys failed. Last error: {last_err}")
