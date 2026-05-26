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

    # ==========================================
    # BUILD TRANSCRIPT
    # ==========================================

    def build(
        self,
        whisper_result,
        diarization
    ):

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
