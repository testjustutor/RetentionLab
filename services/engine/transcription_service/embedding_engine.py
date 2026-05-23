import hashlib


class EmbeddingEngine:

    """
    Semantic embedding engine.
    """

    _MODEL = None

    def __init__(
        self,
        context
    ):

        self.context = context

    # ==========================================
    # LOAD MODEL
    # ==========================================

    @classmethod
    def get_model(cls):

        if cls._MODEL is None:

            try:

                from sentence_transformers import (
                    SentenceTransformer
                )

                cls._MODEL = (
                    SentenceTransformer(
                        "all-MiniLM-L6-v2"
                    )
                )

            except ImportError:

                cls._MODEL = False

        return cls._MODEL

    # ==========================================
    # GENERATE EMBEDDINGS
    # ==========================================

    def generate(
        self,
        transcript
    ):

        model = self.get_model()

        if model is False:

            digest = hashlib.sha256(
                (transcript or "").encode(
                    "utf-8"
                )
            ).digest()

            vector = [
                round(byte / 255, 6)
                for byte in digest
            ]

            return {
                "vector": vector,
                "model": "sha256-fallback"
            }

        embedding = model.encode(
            transcript
        )

        return {

            "vector": embedding.tolist(),
            "model": "all-MiniLM-L6-v2"
        }
