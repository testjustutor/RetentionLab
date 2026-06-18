# root/services/engine/orchestrator/engine_main.py

import json
import sys
import traceback

from services.engine.orchestrator.pipeline_context import (
    PipelineContext
)

from services.engine.orchestrator.pipeline_bootstrap import (
    PipelineBootstrap
)

from services.engine.orchestrator.pipeline_runner import (
    PipelineRunner
)


def main():

    """
    Main Python AI Engine Entry.
    Called from:
    Node.js -> pythonBridge.js
    """

    try:

        # ==========================================
        # INPUT VALIDATION
        # ==========================================

        if len(sys.argv) < 4:

            raise RuntimeError(

                "Usage: "
                "python engine_main.py "
                "<input_file> "
                "<config_json> "
                "<project_root>"
            )

        input_file = sys.argv[1]

        config_json = sys.argv[2]

        project_root = sys.argv[3]

        ai_config = json.loads(
            config_json
        )

        # ==========================================
        # CONTEXT CREATION
        # ==========================================

        context = PipelineContext(

            input_file=input_file,

            ai_config=ai_config,

            project_root=project_root
        )

        # ==========================================
        # BOOTSTRAP
        # ==========================================

        bootstrap = PipelineBootstrap(
            context
        )

        bootstrap.initialize()

        # ==========================================
        # RUN PIPELINE
        # ==========================================

        runner = PipelineRunner(
            context
        )

        result = runner.execute()

        # ==========================================
        # SUCCESS RESPONSE
        # ==========================================

        print(
            json.dumps(
                result,
                indent=4
            )
        )

        sys.exit(0)

    except Exception as error:

        failure = {

            "success": False,

            "error": str(error),

            "traceback": traceback.format_exc()
        }

        print(
            json.dumps(
                failure,
                indent=4
            )
        )

        sys.exit(1)


if __name__ == "__main__":

    main()