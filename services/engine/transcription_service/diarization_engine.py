class DiarizationEngine:

    """
    Builds diarization-compatible timeline data from Whisper segments.

    This is not true speaker diarization. It preserves the downstream artifact
    contract until a WhisperX/Pyannote diarizer is enabled.
    """

    def __init__(
        self,
        context
    ):

        self.context = context

    # ==========================================
    # PROCESS
    # ==========================================

    def process(
        self,
        audio_path,
        whisper_result=None
    ):

        segments = (
            whisper_result or {}
        ).get(
            "segments",
            []
        )

        diarization = []

        for index, segment in enumerate(
            segments
        ):

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
                    start
                ),
                2
            )

            text = segment.get(
                "text",
                ""
            ).strip()

            diarization.append({
                "start": start,
                "end": end,
                "speaker": "Speaker 1",
                "text": text,
                "source": "whisper_segment",
                "segment_index": index
            })

        return diarization
