# services/engine/services/api_worker.py
import os
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as _FutureTimeout
from openai import OpenAI

from utils.logger_util import log_with_type

# Same watchdog ceiling as services/engine/ai_client.py - a single attempt
# (one key/provider) never hangs the pipeline forever.
AI_CALL_TIMEOUT = int(os.getenv("AI_CALL_TIMEOUT", "180"))


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
            # No single client built here anymore: Gemini now rotates across
            # every configured GEMINI_API_KEY* on failure (see
            # _gemini_api_keys()/_ask_gemini_with_key() below), so a fresh
            # client is built per attempt with that attempt's key instead.
            return None
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

    @staticmethod
    def _gemini_api_keys():
        """Ordered list of (label, key) for every configured Gemini key:
        GEMINI_API_KEY, then GEMINI_API_KEY1..GEMINI_API_KEY9 from .env (only
        the ones actually set). Mirrors services/engine/ai_client.py's
        rotation so a transient Gemini failure during summary/tutor-eval
        generation also retries across keys instead of failing that task."""
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
        from google import genai
        full_prompt = f"{system_instruction}\n\n{prompt}"
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=self.config.get("geminiModel"),
            contents=full_prompt
        )
        return response.text

    def _ask_openai_like(self, prompt, system_instruction):
        """openai/cloude/ollama path, using the client built in _init_client()."""
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

    def _ask_openai_fallback(self, prompt, system_instruction, api_key):
        """OpenAI fallback used only once every Gemini key has failed. Builds
        its own client from openaiApiKey (ai_config, i.e. config/settings.js)
        or OPENAI_API_KEY from .env - independent of self.client, which is
        None while self.provider == 'gemini'."""
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=self.config.get("openaiModel") or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content

    def _build_attempts(self, prompt, system_instruction):
        """Ordered list of (label, zero-arg callable) to try for this call.

        Only 'gemini' gets multi-key rotation + an automatic fallback to
        OpenAI once every configured Gemini key has failed - anthropic/
        openai/cloude/ollama run exactly as before (a single attempt).
        """
        if self.provider == "gemini":
            gemini_keys = self._gemini_api_keys()
            # .env rotation found nothing - fall back to the single key Node
            # passed through ai_config so existing single-key setups keep working.
            if not gemini_keys and self.config.get("geminiApiKey"):
                gemini_keys = [("geminiApiKey", self.config.get("geminiApiKey"))]
            if not gemini_keys:
                raise RuntimeError("AI Provider error: geminiApiKey not configured")

            attempts = [
                (
                    f"gemini ({label})",
                    (lambda k=key: self._ask_gemini_with_key(k, prompt, system_instruction)),
                )
                for label, key in gemini_keys
            ]

            openai_key = self.config.get("openaiApiKey") or os.getenv("OPENAI_API_KEY")
            if openai_key:
                attempts.append((
                    "openai (fallback after all Gemini keys failed)",
                    (lambda: self._ask_openai_fallback(prompt, system_instruction, openai_key)),
                ))
            return attempts

        if self.provider == "anthropic":
            return [("anthropic", lambda: self._ask_anthropic(prompt, system_instruction))]
        return [(self.provider, lambda: self._ask_openai_like(prompt, system_instruction))]

    def ask_ai(self, prompt, system_instruction="You are a helpful assistant."):
        attempts = self._build_attempts(prompt, system_instruction)
        last_err = None

        for label, fn in attempts:
            log_with_type("info", f"summary_or_tutor_eval/ai_api: calling {label}", "PYTHON_ENGINE")

            # Watchdog: never let ONE attempt hang the pipeline - each key/
            # provider gets its own timeout so a hang on key #1 doesn't cost
            # key #2 its chance; only a genuine failure/timeout moves on.
            executor = ThreadPoolExecutor(max_workers=1)
            try:
                future = executor.submit(fn)
                try:
                    result = future.result(timeout=AI_CALL_TIMEOUT)
                    log_with_type("info", f"summary_or_tutor_eval/ai_api: {label} responded OK", "PYTHON_ENGINE")
                    return result
                except _FutureTimeout:
                    last_err = RuntimeError(f"{label} did not respond within {AI_CALL_TIMEOUT}s")
                    log_with_type(
                        "warning",
                        f"summary_or_tutor_eval/ai_api: {label} timed out after {AI_CALL_TIMEOUT}s - "
                        f"trying next option if available",
                        "PYTHON_ENGINE",
                    )
                except Exception as e:
                    last_err = e
                    log_with_type(
                        "warning",
                        f"summary_or_tutor_eval/ai_api: {label} failed -> {e} - trying next option if available",
                        "PYTHON_ENGINE",
                    )
            finally:
                executor.shutdown(wait=False)

        log_with_type("error", f"summary_or_tutor_eval/ai_api: all providers/keys exhausted -> {last_err}", "PYTHON_ENGINE")
        raise RuntimeError(f"AI Provider error: all providers/keys failed. Last error: {last_err}")
