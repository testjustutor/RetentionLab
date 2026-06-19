# root/services/engine/dashboard/health_endpoint.py

class HealthEndpoint:

    """
    Health response generator.
    """

    @staticmethod
    def response():

        return {

            "status": "healthy"
        }