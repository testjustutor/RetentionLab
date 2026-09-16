"""
services/engine/services/__init__.py
=========================
Consolidated engine services package (AI, media, transcription, summary, shared
helpers) flattened into a single folder.

NOTE: this used to also eagerly import AiAuditService (audit_worker.py) and
AuditService (ai_audit.py) here. Both are legacy/unused duplicate scoring
implementations, explicitly marked as such in their own module comments and
in services/engine/task/audit_task.py ("Do NOT import
services.engine.services.ai_audit / audit_worker here - those are legacy
duplicate implementations with different scoring math and are no longer
wired into the pipeline"). Nothing in the live pipeline instantiates either
class - the canonical audit engine is services.engine.audit_service.AuditService
(a different class, despite the name collision with ai_audit.py's AuditService).
Since a package's __init__.py always runs before any of its submodules import,
these two were dead weight loaded on every engine run; removed here so
audit_worker.py / ai_audit.py are only loaded if something explicitly imports
them directly by module path in the future.
"""
from .api_worker import AiApiService
from .media import MediaService
from .summary import SummaryService
from .transcription import TranscriptionService

__all__ = [
    "AiApiService",
    "MediaService",
    "SummaryService",
    "TranscriptionService",
]