"""
services/engine/assemblyai_engine/client.py

Thin, reusable wrapper around aai.Transcriber so callers never touch the
raw SDK object directly.
"""
from typing import Any, Dict, Optional

from .config import init_sdk, build_transcription_config
from utils.logger_util import log_with_type


class AssemblyAIClient:
    def __init__(self, config_opts: Optional[Dict[str, Any]] = None):
        self.aai = init_sdk()
        self.config = build_transcription_config(self.aai, config_opts)
        self.transcriber = self.aai.Transcriber(config=self.config)

    def transcribe(self, audio_path_or_url: str):
        """Blocking call. Returns the raw aai.Transcript object."""
        log_with_type("info", f"assemblyai_engine: submitting {audio_path_or_url}", "PYTHON_ENGINE")
        transcript = self.transcriber.transcribe(audio_path_or_url)
        if transcript.status == self.aai.TranscriptStatus.error:
            raise RuntimeError(f"AssemblyAI transcription failed: {transcript.error}")
        return transcript

    def transcribe_async(self, audio_path_or_url: str):
        """Non-blocking. Returns a concurrent.futures.Future."""
        return self.transcriber.transcribe_async(audio_path_or_url)

    def get_by_id(self, transcript_id: str):
        return self.aai.Transcript.get_by_id(transcript_id)

    def list_transcripts(self, **kwargs):
        return self.transcriber.list_transcripts(**kwargs)