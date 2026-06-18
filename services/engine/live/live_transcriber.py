# services/engine/live/live_transcriber.py

class LiveTranscriber:

    """
    Future realtime transcription engine.
    """

    def __init__(
        self,
        context
    ):

        self.context = context

    # ==========================================
    # STREAM
    # ==========================================

    def stream(
        self,
        chunk
    ):

        return {

            "status": "pending",

            "chunk_size": len(chunk)
        }