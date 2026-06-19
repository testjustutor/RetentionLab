# root/services/engine/orchestrator/pipeline_bootstrap.py

import os

from services.engine.shared.cache_manager import (
    CacheManager
)


class PipelineBootstrap:

    """
    Responsible for:
    - startup validation
    - runtime preparation
    - cache directory checks
    - environment validation
    """

    REQUIRED_DIRECTORIES = [

        "recordings",

        "transcripts",

        "summaries",

        "intel",

        "cache_whisper",

        "cache_embeddings",

        "cache_audio_transcripts",

        "cache_voice_activity",

        "cache_diarization",

        "cache_topic_trackers",

        "cache_audits",

        "cache_captions_raw",

        "cache_chat_logs",

        "cache_llm_prompts",

        "cache_screenshots",

        "cache_voiceprints"
    ]

    def __init__(
        self,
        context
    ):

        self.context = context

    # ==========================================
    # BOOTSTRAP PIPELINE
    # ==========================================

    def initialize(self):

        print(
            "\n[BOOTSTRAP] Initializing pipeline...",
            flush=True
        )

        self._validate_environment()

        self._prepare_directories()

        print(
            "[BOOTSTRAP] Pipeline initialized.\n",
            flush=True
        )

    # ==========================================
    # ENVIRONMENT VALIDATION
    # ==========================================

    def _validate_environment(self):

        if not self.context.input_file:

            raise RuntimeError(
                "Missing input file."
            )

    # ==========================================
    # DIRECTORY PREPARATION
    # ==========================================

    def _prepare_directories(self):

        for directory_key in (
            self.REQUIRED_DIRECTORIES
        ):

            path = self.context.storage_paths.get(
                directory_key
            )

            if not path:

                continue

            CacheManager.ensure_directory(
                path
            )
