# root/services/platforms/google-meet/meetJoiner/preJoinMedia.js

import os
import sys
import json

sys.stdout.reconfigure(
    encoding="utf-8"
)

sys.stderr.reconfigure(
    encoding="utf-8"
)

sys.stdout.reconfigure(
    line_buffering=True
)

# ==========================================
# PROJECT ROOT SETUP
# ==========================================

current_dir = os.path.dirname(
    os.path.abspath(__file__)
)

project_root = os.path.abspath(
    os.path.join(
        current_dir,
        "../.."
    )
)

if project_root not in sys.path:

    sys.path.insert(
        0,
        project_root
    )

# ==========================================
# IMPORTS
# ==========================================

from services.engine.orchestrator.pipeline_context import (
    PipelineContext
)

from services.engine.orchestrator.pipeline_runner import (
    PipelineRunner
)

# ==========================================
# ENGINE ENTRYPOINT
# ==========================================


def run_pipeline(
    input_file,
    ai_settings_json
):

    # ==========================================
    # PARSE AI CONFIG
    # ==========================================

    ai_config = json.loads(
        ai_settings_json
    )

    # ==========================================
    # BUILD SHARED CONTEXT
    # ==========================================

    context = PipelineContext(
        input_file=input_file,
        ai_config=ai_config,
        project_root=project_root
    )

    # ==========================================
    # START ORCHESTRATOR
    # ==========================================

    runner = PipelineRunner(
        context
    )

    return runner.execute()


# ==========================================
# CLI ENTRY
# ==========================================

if __name__ == "__main__":

    import argparse

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "input_file"
    )

    parser.add_argument(
        "ai_settings_json"
    )

    args = parser.parse_args()

    result = run_pipeline(
        args.input_file,
        args.ai_settings_json
    )

    print(
        json.dumps(result)
    )
