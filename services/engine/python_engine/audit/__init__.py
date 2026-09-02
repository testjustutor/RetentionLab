"""
services/engine/python_engine/audit
===================================

AI audit (rubric-driven) pipeline within the consolidated engine.

Flow:
    1. Load the rubric (categories + indicators) from the DB.
    2. Build a compact per-indicator prompt (code|gate|benchmark) + transcript.
    3. Send it to the configured AI provider (Anthropic / Gemini / OpenAI / Ollama).
    4. Parse + expand the LLM response: compute category scores, gate failures,
       and the weighted OQI score in code.
    5. Persist per-indicator results to `ai_audit_results` and the summary to
       `session_rubric_summary`.
    6. Save the exact request + raw response to a prompt/audit file for replay.

Everything here logs via `utils.logger_util.log_with_type` and depends only on
standard library + the app's `database/python_db` + the DB - NOT on
`services/engine/*`.
"""
from .audit_service import AuditService

__all__ = ["AuditService"]