# services/engine/transcription_service/transcript_chunker.py

class TranscriptChunker:

    """
    Splits transcript into chunks.
    """

    @staticmethod
    def chunk(
        transcript,
        chunk_size=120
    ):

        words = transcript.split()

        chunks = []

        current = []

        for word in words:

            current.append(word)

            if len(current) >= chunk_size:

                chunks.append(
                    " ".join(current)
                )

                current = []

        if current:

            chunks.append(
                " ".join(current)
            )

        return chunks