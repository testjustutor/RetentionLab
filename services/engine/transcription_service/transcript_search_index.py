# services/engine/transcription_service/transcript_search_index.py

class TranscriptSearchIndex:

    """
    Builds searchable transcript index.
    """

    @staticmethod
    def build(
        transcript
    ):

        index = {}

        words = transcript.split()

        for i, word in enumerate(words):

            word = word.lower()

            index.setdefault(
                word,
                []
            )

            index[word].append(i)

        return index