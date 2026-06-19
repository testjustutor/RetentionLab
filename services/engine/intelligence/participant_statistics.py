# services/engine/intelligence/participant_statistics.py

class ParticipantStatistics:

    """
    Participant analytics.
    """

    @staticmethod
    def build(
        talk_ratio
    ):

        participants = []

        for speaker, ratio in (
            talk_ratio.items()
        ):

            participants.append({

                "speaker": speaker,

                "talk_ratio": ratio
            })

        return participants