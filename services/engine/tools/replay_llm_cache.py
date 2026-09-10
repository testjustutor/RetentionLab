#!/usr/bin/env python3
"""
services/engine/tools/replay_llm_cache.py

Replay a saved LLM request cache file against the currently configured AI
provider, and diff the fresh output against the paired stored response file.

Every provider is non-deterministic (temperature > 0 by default, provider
model revisions drift over time), so this is a DRIFT-CHECK tool, not a
byte-for-byte equality test: it always prints both outputs and a similarity
score, and only exits non-zero on an outright call failure - never merely
because the text differs from the cached response.

Usage:
    python -m services.engine.tools.replay_llm_cache \
        storage/cache_llm_prompts/PROMPT_<base_id>_audit.json

    # or point it straight at the response file - the request path is the
    # request file's sibling in cache_llm_prompts/ under the same name:
    python -m services.engine.tools.replay_llm_cache \
        storage/cache_llm_prompts_responce/RESPONSE_<base_id>_audit.json

Run from the project root (so the "services"/"database"/"utils" packages
this script imports are importable).
"""
import argparse
import difflib
import json
import os
import sys


def _project_root():
    # services/engine/tools/replay_llm_cache.py -> project root is 3 dirs up.
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", "..", ".."))


def _resolve_paths(input_path):
    """Given either a request or response path, return (request_path, the
    sibling response_path if it exists else None)."""
    input_path = os.path.abspath(input_path)
    dirname = os.path.dirname(input_path)
    basename = os.path.basename(input_path)

    if basename.startswith("PROMPT_"):
        request_path = input_path
        response_dir = os.path.join(os.path.dirname(dirname), "cache_llm_prompts_responce")
        response_path = os.path.join(response_dir, "RESPONSE_" + basename[len("PROMPT_"):])
    elif basename.startswith("RESPONSE_"):
        response_path = input_path
        request_dir = os.path.join(os.path.dirname(dirname), "cache_llm_prompts")
        request_path = os.path.join(request_dir, "PROMPT_" + basename[len("RESPONSE_"):])
    else:
        raise ValueError(f"Not a recognized cache file name (expected PROMPT_*/RESPONSE_* prefix): {basename}")

    return request_path, (response_path if os.path.exists(response_path) else None)


def _load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _make_ai_client(provider_hint):
    """Build a plain AiClient (services/engine/ai_client.py). It reads
    AI_PROVIDER / *_API_KEY / *_MODEL from the environment (.env), so the
    replay uses whatever provider/model/credentials are CURRENTLY
    configured - not necessarily the ones the cached request was made
    with. A mismatch is reported, not silently ignored."""
    from services.engine.ai_client import AiClient
    client = AiClient()
    if provider_hint and client.provider != provider_hint:
        print(
            f"[replay] NOTE: cached request was made with provider={provider_hint!r}, "
            f"but the CURRENT environment is configured for provider={client.provider!r} "
            f"(model={client.model!r}). Replaying with the current configuration.",
            file=sys.stderr,
        )
    return client


def _similarity(a, b):
    return difflib.SequenceMatcher(None, a or "", b or "").ratio()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("cache_file", help="Path to a PROMPT_*.json request file or RESPONSE_*.json response file")
    parser.add_argument("--full", action="store_true", help="Print the full replayed response text (default: first/last 500 chars)")
    args = parser.parse_args()

    request_path, response_path = _resolve_paths(args.cache_file)

    if not os.path.exists(request_path):
        print(f"[replay] ERROR: request file not found: {request_path}", file=sys.stderr)
        return 2

    request_doc = _load_json(request_path)
    req = request_doc.get("request") or {}
    system_instruction = req.get("system_instruction", "")
    prompt = req.get("prompt", "")

    print(f"[replay] task={request_doc.get('task')} call={request_doc.get('call')} "
          f"base_id={request_doc.get('base_id')} "
          f"cached_provider={request_doc.get('provider')} cached_model={request_doc.get('model')}")
    print(f"[replay] request file: {request_path}")

    stored_response = None
    if response_path:
        response_doc = _load_json(response_path)
        stored_response = response_doc.get("raw_response")
        print(f"[replay] response file: {response_path} (status={response_doc.get('status')})")
    else:
        print("[replay] no paired response file found on disk - will only show the fresh output.")

    if not prompt and not system_instruction:
        print("[replay] ERROR: request file has an empty system_instruction and prompt - nothing to replay.", file=sys.stderr)
        return 2

    client = _make_ai_client(request_doc.get("provider"))

    print("[replay] calling AI...")
    try:
        fresh_response = client.ask_ai(prompt=prompt, system_instruction=system_instruction)
    except Exception as e:
        print(f"[replay] ERROR: AI call failed: {e}", file=sys.stderr)
        return 1

    print(f"[replay] fresh response ({len(fresh_response)} chars, provider={client.provider}, model={client.model}):")
    if args.full or len(fresh_response) <= 1000:
        print(fresh_response)
    else:
        print(fresh_response[:500] + "\n...\n" + fresh_response[-500:])

    if stored_response is None:
        print("[replay] (no stored response to diff against)")
        return 0

    ratio = _similarity(stored_response, fresh_response)
    print(f"\n[replay] similarity to stored response: {ratio:.1%} "
          f"({'identical' if ratio == 1.0 else 'similar' if ratio >= 0.8 else 'DIFFERENT'})")
    print(
        "[replay] NOTE: providers are non-deterministic - a similarity below 100% is "
        "expected and is not by itself a bug. Use --full to inspect both texts."
    )
    if args.full and ratio < 1.0:
        print("\n[replay] unified diff (stored -> fresh):")
        diff = difflib.unified_diff(
            (stored_response or "").splitlines(keepends=True),
            (fresh_response or "").splitlines(keepends=True),
            fromfile="stored_response",
            tofile="fresh_response",
        )
        sys.stdout.writelines(diff)

    return 0


if __name__ == "__main__":
    sys.exit(main())
