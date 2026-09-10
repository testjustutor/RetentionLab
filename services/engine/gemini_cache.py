"""
services/engine/gemini_cache.py

Persistent (cross-process) lookup for Gemini explicit context caching, so
the audit engine's static per-call content (system instruction + rubric
indicator catalog, currently ~1,000+ tokens and BYTE-IDENTICAL on every
audit call for a given rubric) is uploaded to Gemini ONCE per rubric
version and referenced by a cheap handle on every later call, instead of
being re-sent as full-price input tokens every single time.

Why a file instead of an in-memory dict: services/engine spawns a fresh
Python process per job (see services/engine/services/python_runner.js), so
anything cached only in a module-level variable would never survive to the
next call and this whole module would be a no-op. A small JSON state file
under storage/ survives across processes without needing a DB migration.

Cache identity / rubric-change safety: entries are keyed by
(model, cache_key), where cache_key is the CALLER's fingerprint of the
static content - audit_service.py uses a short hash of the indicator
catalog text it built from the DB. Edit a rubric indicator's benchmark
text, add/remove an indicator, or flip is_gate/requires_video, and the
indicator catalog text changes, so its hash changes, so this module
transparently starts creating (and using) a brand new cache under the new
key - there is no explicit "invalidate on rubric change" step needed, and
there is no way to accidentally score against a stale cached rubric.

This module NEVER raises out of get_or_create_cache(): any failure (content
too small for Gemini's caching floor, API error, disk error saving state)
is logged and answered with None, so callers can always fall back to a
plain uncached call instead of breaking the audit.

Known limitation: state-file writes are guarded by an in-process lock only,
not a cross-process file lock. Two engine processes racing to create a
cache for the same brand-new rubric hash at the same moment can each create
their own Gemini cache (wasteful, not incorrect - later reads just settle
on whichever state.json write landed last). Acceptable for now given how
rarely the rubric changes; revisit with a proper file lock (e.g. fcntl) if
that race turns out to matter in practice.
"""
import json
import os
import threading
import time

from utils.logger_util import log_with_type

_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_DIR, "..", ".."))
_STATE_DIR = os.path.join(_PROJECT_ROOT, "storage", "cache_gemini_context")
_STATE_PATH = os.path.join(_STATE_DIR, "state.json")
_LOCK = threading.Lock()

DEFAULT_TTL_SECONDS = int(os.getenv("GEMINI_CACHE_TTL_SECONDS", "3600"))
# Gemini rejects caches.create() for content below its minimum token floor
# (varies by model/version). Skip the attempt below this size instead of
# paying for an API round trip that's guaranteed to fail. Tune via env if
# your model's actual floor differs.
MIN_CACHE_TOKENS_ESTIMATE = int(os.getenv("GEMINI_CACHE_MIN_TOKENS", "1024"))


def _load_state():
    try:
        with open(_STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_state(state):
    os.makedirs(_STATE_DIR, exist_ok=True)
    tmp_path = _STATE_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(state, f)
    os.replace(tmp_path, _STATE_PATH)  # atomic on both POSIX and Windows


def _entry_key(model, cache_key):
    return f"{model}::{cache_key}"


def get_or_create_cache(client, model, cache_key, system_instruction, cache_context,
                         ttl_seconds=None):
    """Return a Gemini cached-content resource name for (model, cache_key),
    creating it if missing or expired (with a 60s safety margin so a cache
    that's about to expire isn't handed out for a call that might still be
    in flight when it does). Returns None - never raises - if caching isn't
    usable right now, so the caller can transparently fall back to a plain
    uncached call.
    """
    ttl_seconds = ttl_seconds or DEFAULT_TTL_SECONDS

    approx_tokens = len(system_instruction or "") // 4 + len(cache_context or "") // 4
    if approx_tokens < MIN_CACHE_TOKENS_ESTIMATE:
        log_with_type(
            "info",
            f"audit/gemini_cache: static content (~{approx_tokens} tok) below "
            f"caching floor (~{MIN_CACHE_TOKENS_ESTIMATE} tok) - skipping cache, using direct call",
            "PYTHON_ENGINE",
        )
        return None

    key = _entry_key(model, cache_key)
    now = time.time()

    with _LOCK:
        state = _load_state()
        entry = state.get(key)
        if entry and entry.get("expires_at", 0) > now + 60:
            return entry["cache_name"]

        try:
            from google.genai import types
            cached = client.caches.create(
                model=model,
                config=types.CreateCachedContentConfig(
                    display_name=f"audit-rubric-{cache_key}"[:128],
                    system_instruction=system_instruction,
                    contents=[cache_context],
                    ttl=f"{ttl_seconds}s",
                ),
            )
        except Exception as e:
            log_with_type(
                "warning",
                f"audit/gemini_cache: cache creation failed ({e}) - falling back to uncached call",
                "PYTHON_ENGINE",
            )
            return None

        cache_name = getattr(cached, "name", None)
        if not cache_name:
            log_with_type(
                "warning",
                "audit/gemini_cache: caches.create() returned no name - falling back to uncached call",
                "PYTHON_ENGINE",
            )
            return None

        state[key] = {
            "cache_name": cache_name,
            "created_at": now,
            "expires_at": now + ttl_seconds,
        }
        try:
            _save_state(state)
        except Exception as e:
            # We still got a usable cache_name for THIS call even if we
            # couldn't persist it for reuse next time - don't throw that away.
            log_with_type("warning", f"audit/gemini_cache: could not persist cache state ({e})", "PYTHON_ENGINE")

        log_with_type(
            "info",
            f"audit/gemini_cache: created cache {cache_name} for {key} (ttl={ttl_seconds}s)",
            "PYTHON_ENGINE",
        )
        return cache_name
