# root/services/engine/transcription_service/embedding_engine.py

from utils.logger_util import log_with_type

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

        log_with_type("info", "Engine(transcription_service > embedding_engine) : Initialized", "INTEL")

    # ==========================================
    # LOAD MODEL
    # ==========================================

    @classmethod
    def get_model(cls):

        log_with_type("info", "Engine(transcription_service > embedding_engine) : Loading model check", "INTEL")

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

                log_with_type("info", "Engine(transcription_service > embedding_engine) : Model loaded all-MiniLM-L6-v2", "INTEL")

            except ImportError:

                cls._MODEL = False

                log_with_type("info", "Engine(transcription_service > embedding_engine) : sentence-transformers not installed fallback enabled", "INTEL")

        return cls._MODEL

    # ==========================================
    # GENERATE EMBEDDINGS
    # ==========================================

    def generate(
        self,
        transcript
    ):

        log_with_type("info", f"Engine(transcription_service > embedding_engine) : Generate started transcript_length={len(transcript or '')}", "INTEL")

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

            log_with_type("info", "Engine(transcription_service > embedding_engine) : Fallback SHA256 embedding used", "INTEL")

            return {
                "vector": vector,
                "model": "sha256-fallback"
            }

        embedding = model.encode(
            transcript
        )

        log_with_type("info", "Engine(transcription_service > embedding_engine) : Model embedding generated", "INTEL")

        return {

            "vector": embedding.tolist(),
            "model": "all-MiniLM-L6-v2"
        }
