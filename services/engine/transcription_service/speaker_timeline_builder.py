# services/engine/transcription_service/speaker_timeline_builder.py

class SpeakerTimelineBuilder:

    """
    Builds speaker timelines.
    """

    @staticmethod
    def build(
        diarization
    ):

        timeline = {}

        for item in diarization:

            speaker = item["speaker"]

            timeline.setdefault(
                speaker,
                []
            )

            timeline[speaker].append({

                "start": item["start"],

                "end": item["end"]
            })

        return timeline