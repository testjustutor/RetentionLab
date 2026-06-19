# root/services/engine/shared/result_objects.py

class PipelineResult:

    """
    Shared pipeline response object.
    """

    @staticmethod
    def success(
        payload
    ):

        return {

            "success": True,

            "data": payload
        }

    @staticmethod
    def failure(
        error
    ):

        return {

            "success": False,

            "error": str(error)
        }