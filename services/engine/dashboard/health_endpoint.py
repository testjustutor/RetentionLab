class HealthEndpoint:

    """
    Health response generator.
    """

    @staticmethod
    def response():

        return {

            "status": "healthy"
        }