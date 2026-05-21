class RuntimeStateManager:

    """
    Stores active pipeline states.
    """

    ACTIVE_PIPELINES = {}

    # ==========================================
    # REGISTER PIPELINE
    # ==========================================

    @classmethod
    def register(
        cls,
        meeting_id,
        state
    ):

        cls.ACTIVE_PIPELINES[
            meeting_id
        ] = state

    # ==========================================
    # REMOVE PIPELINE
    # ==========================================

    @classmethod
    def remove(
        cls,
        meeting_id
    ):

        if meeting_id in cls.ACTIVE_PIPELINES:

            del cls.ACTIVE_PIPELINES[
                meeting_id
            ]

    # ==========================================
    # GET STATE
    # ==========================================

    @classmethod
    def get(
        cls,
        meeting_id
    ):

        return cls.ACTIVE_PIPELINES.get(
            meeting_id
        )