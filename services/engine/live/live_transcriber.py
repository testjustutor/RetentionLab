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