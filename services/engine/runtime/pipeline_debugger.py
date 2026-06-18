# root/services/engine/runtime/pipeline_debugger.py

import traceback


class PipelineDebugger:

    """
    Pipeline exception helper.
    """

    @staticmethod
    def dump(
        error
    ):

        return {

            "error": str(error),

            "traceback": (
                traceback.format_exc()
            )
        }