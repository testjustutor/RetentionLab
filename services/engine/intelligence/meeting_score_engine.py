# services/engine/intelligence/meeting_score_engine.py

class MeetingScoreEngine:

    """
    Calculates overall meeting score.
    """

    @staticmethod
    def calculate(
        engagement,
        risks
    ):

        score = 100

        if engagement == "dominated":

            score -= 20

        score -= len(risks) * 5

        return max(score, 0)