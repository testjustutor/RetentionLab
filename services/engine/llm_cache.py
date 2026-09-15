"""
services/engine/llm_cache.py

Shared helpers for the split LLM request/response cache files used by the
audit AI call in the engine (audit_service.py).

Naming (ONE file pair per LLM call - the engine currently makes ONE AI call
per session, the audit call):

    storage/cache_llm_prompts/PROMPT_<base_id>_<call>.json          (request)
    storage/cache_llm_prompts_responce/RESPONSE_<base_id>_<call>.json (response)

<call> identifies the LLM call this pair belongs to - currently always
"audit".

The request file is written BEFORE the AI call (so a request that crashes
mid-call still leaves a record of exactly what was about to be sent) and is
self-contained enough to replay: system_instruction + prompt (kept exactly
as originally sent), the equivalent chat "messages" array, and the
generation "parameters" actually used for the configured provider.

The response file is written AFTER the AI call and holds the EXACT raw text
the provider returned, plus request metadata for standalone readability.

Nothing at runtime reads these files - they exist purely for debugging /
manual replay - so this module intentionally has no read-side API beyond
what a human or the replay script (services/engine/tools/replay_llm_cache.py)
needs.
"""
import os


def llm_cache_paths(request_dir, response_dir, base_id, call):
    """Return (request_path, response_path) for one LLM call.

    request_dir / response_dir are the "cache_llm_prompts" /
    "cache_llm_prompts_responce" folders from
    orchestrator.pipeline_context.build_storage_paths().
    """
    request_path = os.path.join(request_dir, f"PROMPT_{base_id}_{call}.json")
    response_path = os.path.join(response_dir, f"RESPONSE_{base_id}_{call}.json")
    return request_path, response_path


def build_messages(system_instruction, prompt):
    """The chat-style message list every provider path is ultimately built
    from (system_instruction + prompt as a single user turn), stored
    alongside the raw system_instruction/prompt fields so a request file
    can be replayed against any chat-completions-style API without the
    replayer needing to know which provider originally produced it."""
    return [
        {"role": "system", "content": system_instruction or ""},
        {"role": "user", "content": prompt or ""},
    ]


def generation_params(ai_client):
    """Best-effort snapshot of the generation parameters actually used for
    ai_client's configured provider, so a saved request file carries enough
    to configure a replay identically.

    Only covers params this codebase actually sets somewhere (currently:
    Anthropic's max_tokens, read from ai_config when the caller is
    AiApiService, else from the ANTHROPIC_MAX_TOKENS env var when the
    caller is the plain AiClient). Every other provider path (gemini,
    openai, cloude, ollama) uses the SDK/provider default with no override
    in this codebase, so an empty dict is returned for those - accurately
    reflecting that nothing needs to be configured to replay them.
    """
    provider = getattr(ai_client, "provider", None)
    if provider != "anthropic":
        return {}

    max_tokens = None
    config = getattr(ai_client, "config", None)
    if isinstance(config, dict):
        max_tokens = config.get("anthropicMaxTokens")
    if max_tokens is None:
        max_tokens = os.getenv("ANTHROPIC_MAX_TOKENS", "1024")
    try:
        max_tokens = int(max_tokens)
    except (TypeError, ValueError):
        max_tokens = 1024
    return {"max_tokens": max_tokens}
