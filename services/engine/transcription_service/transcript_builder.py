# root/services/engine/transcription_service/transcript_builder.py

from utils.logger_util import log_with_type

import os

from services.engine.shared.file_store import (
    FileStore
)


class TranscriptBuilder:

    """
    Builds final labeled transcript.
    """

    def __init__(
        self,
        context
    ):

        self.context = context

        log_with_type("info", "Engine(transcription_service > transcript_builder) : Initialized", "TRANSCRIPTION")

    # ==========================================
    # BUILD TRANSCRIPT
    # ==========================================

    def build(
        self,
        whisper_result,
        diarization
    ):

        log_with_type("info", f"Engine(transcription_service > transcript_builder) : Build started segments={len(whisper_result.get('segments', []))}", "TRANSCRIPTION")

        segments = whisper_result.get(
            "segments",
            []
        )

        lines = []

        speaker_stats = {}

        diarization_by_index = {
            item.get("segment_index"): item
            for item in diarization
            if isinstance(item, dict)
        }

        for index, segment in enumerate(segments):

            speaker = diarization_by_index.get(
                index,
                {}
            ).get(
                "speaker",
                "Speaker 1"
            )

            text = segment.get(
                "text",
                ""
            ).strip()

            start = round(
                segment.get(
                    "start",
                    0
                ),
                2
            )

            end = round(
                segment.get(
                    "end",
                    0
                ),
                2
            )

            duration = end - start

            speaker_stats[
                speaker
            ] = speaker_stats.get(
                speaker,
                0
            ) + duration

            lines.append(

                f"[{start} - {end}] "
                f"{speaker}: {text}"
            )

        transcript = "\n".join(
            lines
        )

        log_with_type("info", f"Engine(transcription_service > transcript_builder) : Transcript generated lines={len(lines)}", "TRANSCRIPTION")

        transcript_path = os.path.join(

            self.context.storage_paths[
                "cache_audio_transcripts"
            ],

            f"AUDIO_TRANS_{self.context.base_id}.txt"
        )

        FileStore.save_text(

            transcript_path,

            transcript
        )

        log_with_type("info", f"Engine(transcription_service > transcript_builder) : Transcript saved path={transcript_path}", "TRANSCRIPTION")

        total = sum(
            speaker_stats.values()
        )

        talk_ratio = {}

        if total > 0:

            for speaker, value in (
                speaker_stats.items()
            ):

                talk_ratio[
                    speaker
                ] = round(

                    (value / total) * 100,

                    2
                )

        log_with_type("info", f"Engine(transcription_service > transcript_builder) : Talk ratio computed speakers={len(talk_ratio)}", "TRANSCRIPTION")

        return {

            "transcript_path": (
                transcript_path
            ),

            "transcript": (
                transcript
            ),

            "diarization": (
                diarization
            ),

            "talk_ratio": (
                talk_ratio
            )
        }

    # ==========================================
    # BUILD PLAIN TRANSCRIPT (no speaker labels / diarization)
    # ==========================================

    def build_plain_text(
        self,
        whisper_result
    ):
        """Build a plain transcript from Whisper segments (no speaker labels)."""

        segments = whisper_result.get(
            "segments",
            []
        )

        lines = []
        for segment in segments:
            text = segment.get("text", "").strip()
            if text:
                lines.append(text)

        transcript = "\n".join(lines)

        log_with_type("info", f"Engine(transcription_service > transcript_builder) : Plain transcript generated lines={len(lines)}", "TRANSCRIPTION")

        transcript_path = os.path.join(
            self.context.storage_paths["cache_audio_transcripts"],
            f"AUDIO_TRANS_{self.context.base_id}.txt"
        )

        FileStore.save_text(transcript_path, transcript)

        log_with_type("info", f"Engine(transcription_service > transcript_builder) : Plain transcript saved path={transcript_path}", "TRANSCRIPTION")

        return {
            "transcript_path": transcript_path,
            "transcript": transcript
        }

    # ==========================================
    # STATIC HELPERS
    # ==========================================

    @staticmethod
    def compute_talk_ratio(diarization):
        """Compute per-speaker talk-time percentage from labeled diarization segments."""

        speaker_stats = {}
        for item in diarization:
            if not isinstance(item, dict):
                continue
            start = float(item.get("start", 0))
            end = float(item.get("end", start))
            duration = max(end - start, 0)
            speaker = item.get("speaker", "Speaker 1")
            speaker_stats[speaker] = speaker_stats.get(speaker, 0) + duration

        total = sum(speaker_stats.values())
        talk_ratio = {}

        if total > 0:
            for speaker, value in speaker_stats.items():
                talk_ratio[speaker] = round((value / total) * 100, 2)

        log_with_type("info", f"Engine(transcription_service > transcript_builder) : Talk ratio computed speakers={len(talk_ratio)}", "TRANSCRIPTION")

        return talk_ratio
