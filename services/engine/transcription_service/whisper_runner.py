class WhisperRunner:

    """
    Executes Whisper inference.
    """

    def __init__(
        self,
        context
    ):

        self.context = context

    # ==========================================
    # RUN INFERENCE
    # ==========================================

    def run(
        self,
        model,
        audio_path
    ):

        result = model.transcribe(

            audio_path,

            verbose=False
        )

        return result