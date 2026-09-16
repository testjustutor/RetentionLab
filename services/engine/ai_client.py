"""
services/engine/ai_client.py

AI provider client for the consolidated python_engine audit. Reads provider
credentials from the environment (root .env via python-dotenv) and calls the
active provider (anthropic / gemini / openai / ollama).

Which provider/model/temperature/max_tokens is actually used: the
Super Admin > Settings > AI Providers page (ai_providers DB table) is
consulted FIRST. If, and only if, the table has EXACTLY ONE row with
enabled = 1, that row's provider_key/default_model/default_temperature/
default_max_tokens win. Any other case - the table is unreachable, empty,
has zero enabled rows, or (a known seed-data issue) has more than one row
enabled at once, which makes "the active provider" ambiguous - falls back
to the original .env-only behavior (AI_PROVIDER / <PROVIDER>_MODEL / etc.)
untouched. This is deliberately conservative: a DB lookup is an
enhancement, never something that can break or silently redirect an
already-working install.

Exposes a single method `ask_ai(prompt, system_instruction)` returning the
model's raw text, plus `provider`/`model` for metadata.

Optional Gemini context caching: `ask_ai` also accepts `cache_key` +
`cache_context` (a static text block, e.g. the audit rubric's indicator
catalog, plus a short fingerprint of it). When the caller supplies both AND
GEMINI_USE_CACHING is truthy in the environment, the gemini path uploads
`cache_context` to Gemini once per (model, cache_key) via
services/engine/gemini_cache.py and references it by handle on every later
call instead of resending it as full-price input tokens - see that module
for the rubric-change/cache-invalidation story. Every other provider (and
gemini itself whenever caching is off, unavailable, or fails) just gets
`cache_context + "\n\n" + prompt` concatenated exactly as if the caller had
passed one combined prompt - behavior is byte-identical to before this was
added whenever cache_context is omitted.
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


def _load_enabled_provider_from_db():
    """Look up the Super Admin > Settings > AI Providers table (ai_providers).

    Returns the single enabled row (dict) if, and only if, exactly one row
    has enabled = 1. Returns None in every other case - table unreachable,
    empty, zero enabled rows, or more than one enabled row (ambiguous,
    matches the current seed data which enables all four providers) - so
    __init__ can fall back to the original .env-only behavior untouched.
    Any DB error is caught here and treated as "no override", never raised,
    so a DB/connectivity problem can't break an already-working install.
    """
    try:
        from database.python_db import fetch_all
        rows = fetch_all(
            "SELECT provider_key, default_model, default_temperature, default_max_tokens "
            "FROM ai_providers WHERE enabled = 1"
        )
    except Exception as e:
        log_with_type(
            "warning",
            f"audit/ai_client: ai_providers DB lookup failed ({e}) - using .env config",
            "PYTHON_ENGINE",
        )
        return None

    if not rows:
        return None
    if len(rows) > 1:
        log_with_type(
            "warning",
            f"audit/ai_client: {len(rows)} ai_providers rows are enabled at once "
            f"({[r.get('provider_key') for r in rows]}) - ambiguous, using .env config instead",
            "PYTHON_ENGINE",
        )
        return None
    return rows[0]


class AiClient:
    def __init__(self):
        db_row = _load_enabled_provider_from_db()
        self._db_row = db_row

        if db_row and db_row.get("provider_key"):
            self.provider = str(db_row["provider_key"]).lower()
        else:
            self.provider = (os.getenv("AI_PROVIDER") or "openai").lower()

        self.model = self._resolve_model()
        self.temperature = self._resolve_temperature()
        self.max_tokens = self._resolve_max_tokens()

        source = "ai_providers DB" if db_row else ".env"
        log_with_type(
            "info",
            f"audit/ai_client: provider={self.provider} model={self.model} "
            f"temperature={self.temperature} max_tokens={self.max_tokens} (source={source})",
            "PYTHON_ENGINE",
        )

    def _resolve_model(self):
        key = {
            "anthropic": "ANTHROPIC_MODEL",
            "gemini": "GEMINI_MODEL",
            "openai": "OPENAI_MODEL",
            "ollama": "OLLAMA_MODEL",
        }.get(self.provider)
        env_model = os.getenv(key) or (os.getenv("OLLAMA_MODEL") if self.provider == "ollama" else "")

        if self._db_row and self._db_row.get("default_model"):
            return self._db_row["default_model"]
        return env_model

    def _resolve_temperature(self):
        """Temperature, only when the DB row supplies it (no prior .env
        equivalent existed for this - it was never wired to any provider
        call before now, so there's nothing to fall back to but "unset")."""
        if self._db_row and self._db_row.get("default_temperature") is not None:
            try:
                return float(self._db_row["default_temperature"])
            except (TypeError, ValueError):
                return None
        return None

    def _resolve_max_tokens(self):
        """Max tokens, only when the DB row supplies it. When it doesn't,
        return None and let each _ask_* method keep using its own existing
        .env-based default (ANTHROPIC_MAX_TOKENS / GEMINI_MAX_OUTPUT_TOKENS),
        exactly as before this change."""
        if self._db_row and self._db_row.get("default_max_tokens") is not None:
            try:
                return int(self._db_row["default_max_tokens"])
            except (TypeError, ValueError):
                return None
        return None

    def _ask_anthropic(self, prompt, system_instruction):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not configured")
        url = "https://api.anthropic.com/v1/messages"
        payload = {
            "model": self.model,
            "max_tokens": self.max_tokens if self.max_tokens is not None else int(os.getenv("ANTHROPIC_MAX_TOKENS", "1024")),
            "system": system_instruction,
            "messages": [{"role": "user", "content": prompt}],
        }
        if self.temperature is not None:
            payload["temperature"] = self.temperature
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

    def _ask_gemini_with_key(self, api_key, prompt, system_instruction, cache_key=None, cache_context=None):
        from google import genai
        client = genai.Client(api_key=api_key)

        max_output_tokens = self.max_tokens if self.max_tokens is not None else int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "8192"))
        config_kwargs = {"max_output_tokens": max_output_tokens}
        if self.temperature is not None:
            config_kwargs["temperature"] = self.temperature

        # Disable "thinking"/extended-reasoning tokens for this call. On
        # thinking-capable Gemini models, max_output_tokens caps thinking +
        # visible output TOGETHER - so a model that spends most of its
        # budget on hidden reasoning can leave almost nothing for the actual
        # JSON, silently truncating it mid-object (this broke a real audit
        # run: the model stopped after ~6 of 74 indicators and the response
        # failed to parse, wiping that session's ai_audit_results rows).
        # This is a deterministic classification task - the rubric and
        # scoring rules are fully spelled out in the prompt - so extended
        # reasoning isn't earning its token cost here anyway; turning it off
        # fixes the truncation risk AND further reduces real cost. Defensive
        # + optional via env: if a model/SDK version doesn't support
        # thinking_budget, this is skipped rather than blocking the call.
        if os.getenv("GEMINI_DISABLE_THINKING", "true").strip().lower() in ("1", "true", "yes"):
            try:
                from google.genai import types as _types
                config_kwargs["thinking_config"] = _types.ThinkingConfig(thinking_budget=0)
            except Exception as e:
                log_with_type(
                    "warning",
                    f"audit/ai_client: could not disable Gemini thinking ({e}) - "
                    f"continuing without it (max_output_tokens cap still applies)",
                    "PYTHON_ENGINE",
                )

        # Explicit context caching: only attempted when the caller supplied
        # both cache_key and cache_context AND it's turned on via env - off
        # by default so this is a no-op until deliberately enabled and
        # verified against the live API. Any failure here (content below
        # Gemini's caching floor, API error, SDK shape mismatch) falls back
        # to the plain uncached call below; it never breaks the audit call.
        cached_content_name = None
        use_caching = bool(
            cache_key and cache_context
            and os.getenv("GEMINI_USE_CACHING", "false").strip().lower() in ("1", "true", "yes")
        )
        if use_caching:
            try:
                from .gemini_cache import get_or_create_cache
                cached_content_name = get_or_create_cache(
                    client=client,
                    model=self.model,
                    cache_key=cache_key,
                    system_instruction=system_instruction,
                    cache_context=cache_context,
                )
            except Exception as e:
                log_with_type(
                    "warning",
                    f"audit/ai_client: gemini caching unavailable ({e}) - falling back to uncached call",
                    "PYTHON_ENGINE",
                )
                cached_content_name = None

        if cached_content_name:
            # The system instruction + cache_context are already baked into
            # the cache - send ONLY the variable per-call content.
            contents = prompt
            config_kwargs["cached_content"] = cached_content_name
        else:
            prefix = f"{system_instruction}\n\n{cache_context}\n\n" if cache_context else f"{system_instruction}\n\n"
            contents = f"{prefix}{prompt}"

        # Apply the config built above, but GRADUATED rather than
        # all-or-nothing: some part of config_kwargs can be rejected by a
        # given model/API version (e.g. gemini-3.6-flash returned 400
        # INVALID_ARGUMENT for thinking_config specifically, even though
        # max_output_tokens alone was accepted fine) - a single try/except
        # around the whole config used to mean ANY one rejected field threw
        # away every optimization at once (including ones that DID work) and
        # fell all the way back to an unbounded, uncached, ~40s call. Instead,
        # strip the most-likely-unsupported fields one at a time and retry,
        # so a single bad field degrades gracefully instead of wiping
        # everything - e.g. losing just thinking_config still keeps the
        # (working) output-token cap active.
        attempt_variants = [dict(config_kwargs)]
        if "thinking_config" in config_kwargs:
            without_thinking = dict(config_kwargs)
            del without_thinking["thinking_config"]
            attempt_variants.append(without_thinking)
        if "cached_content" in config_kwargs:
            bare = {k: v for k, v in config_kwargs.items() if k not in ("thinking_config", "cached_content")}
            if bare not in attempt_variants:
                attempt_variants.append(bare)

        uncached_contents = f"{system_instruction}\n\n{cache_context}\n\n{prompt}" if cache_context else f"{system_instruction}\n\n{prompt}"

        for i, variant in enumerate(attempt_variants):
            # `contents` must match what THIS variant's config expects: if
            # the variant still references the cache (cached_content kwarg
            # present), send just the variable prompt part (contents, set
            # above); if this variant dropped the cache, the system
            # instruction + indicator block need to be back in the text.
            variant_contents = contents if "cached_content" in variant else uncached_contents
            try:
                from google.genai import types
                config = types.GenerateContentConfig(**variant)
                response = client.models.generate_content(model=self.model, contents=variant_contents, config=config)
                if i > 0:
                    dropped = set(config_kwargs) - set(variant)
                    log_with_type(
                        "info",
                        f"audit/ai_client: generate_content succeeded after dropping {dropped} "
                        f"from config (tier {i + 1}/{len(attempt_variants)})",
                        "PYTHON_ENGINE",
                    )
                return response.text
            except Exception as e:
                is_last = (i + 1 == len(attempt_variants))
                log_with_type(
                    "warning",
                    f"audit/ai_client: generate_content failed with config keys={list(variant)} ({e}) - "
                    + ("falling back to fully uncapped/uncached call" if is_last else "trying next fallback tier"),
                    "PYTHON_ENGINE",
                )

        # Last resort: exactly the original (pre-optimization) call shape -
        # no config object at all, in case google-genai's own defaults for
        # an unrecognized/malformed GenerateContentConfig are themselves
        # part of the problem.
        response = client.models.generate_content(model=self.model, contents=uncached_contents)
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

    def _build_attempts(self, prompt, system_instruction, cache_key=None, cache_context=None):
        """Ordered list of (label, zero-arg callable) to try for this call.

        Only 'gemini' gets multi-key rotation + an automatic provider
        fallback to OpenAI once every configured Gemini key has failed -
        anthropic/openai/ollama run exactly as before (a single attempt),
        since only Gemini keys + an OpenAI fallback were asked for.

        cache_key/cache_context only ever affect the gemini attempts (the
        only provider this codebase has caching support for) - every other
        attempt gets `cache_context + prompt` concatenated into one prompt,
        so behavior for them is identical to before caching existed.
        """
        effective_prompt = f"{cache_context}\n\n{prompt}" if cache_context else prompt

        if self.provider == "gemini":
            gemini_keys = self._gemini_api_keys()
            if not gemini_keys:
                raise RuntimeError("GEMINI_API_KEY not configured")

            attempts = [
                (
                    f"gemini ({label})",
                    (lambda k=key: self._ask_gemini_with_key(
                        k, prompt, system_instruction, cache_key=cache_key, cache_context=cache_context
                    )),
                )
                for label, key in gemini_keys
            ]

            if os.getenv("OPENAI_API_KEY"):
                attempts.append((
                    "openai (fallback after all Gemini keys failed)",
                    (lambda: self._ask_openai_like(effective_prompt, system_instruction)),
                ))
            return attempts

        if self.provider == "anthropic":
            return [("anthropic", lambda: self._ask_anthropic(effective_prompt, system_instruction))]
        if self.provider == "ollama":
            return [("ollama", lambda: self._ask_ollama(effective_prompt, system_instruction))]
        return [("openai", lambda: self._ask_openai_like(effective_prompt, system_instruction))]

    def ask_ai(self, prompt, system_instruction="You are a helpful assistant.", cache_key=None, cache_context=None):
        attempts = self._build_attempts(prompt, system_instruction, cache_key=cache_key, cache_context=cache_context)
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
