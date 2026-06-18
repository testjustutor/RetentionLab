# root/services/engine/runtime/model_pool_manager.py

class ModelPoolManager:

    """
    Shared model pool.
    """

    MODELS = {}

    # ==========================================
    # REGISTER
    # ==========================================

    @classmethod
    def register(
        cls,
        key,
        model
    ):

        cls.MODELS[key] = model

    # ==========================================
    # GET
    # ==========================================

    @classmethod
    def get(
        cls,
        key
    ):

        return cls.MODELS.get(
            key
        )