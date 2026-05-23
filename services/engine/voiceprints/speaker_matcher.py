import numpy as np


class SpeakerMatcher:

    """
    Matches speakers using cosine similarity.
    """

    @staticmethod
    def cosine_similarity(
        a,
        b
    ):

        a = np.array(a)

        b = np.array(b)

        denominator = (
            np.linalg.norm(a)
            * np.linalg.norm(b)
        )

        if denominator == 0:

            return 0

        return float(

            np.dot(a, b)
            / denominator
        )

    # ==========================================
    # MATCH
    # ==========================================

    @classmethod
    def match(
        cls,
        query,
        known,
        threshold=0.80
    ):

        best = None

        best_score = 0

        for item in known:

            score = cls.cosine_similarity(

                query,

                item["embedding"]
            )

            if score > best_score:

                best_score = score

                best = item

        if best_score >= threshold:

            return {

                "matched": True,

                "speaker": best,

                "score": round(
                    best_score,
                    4
                )
            }

        return {

            "matched": False
        }