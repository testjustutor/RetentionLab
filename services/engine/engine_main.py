# services/engine/engine_main.py

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

# IMPORTANT: remove this script's own directory (services/engine) from
# sys.path. When engine_main.py is executed as a script (as the Node bridge
# does), Python prepends the script's folder to sys.path. That folder contains
# a package named `services` (services/engine/services) which SHADOWS the
# project-root `services` package (root services/ has no __init__.py, so the
# nested `services` folder is treated as a regular package and wins). Removing
# the script dir guarantees `import services...` always resolves to the project
# root, which is required for `services.engine.services.*` imports to work.
try:
    sys.path.remove(current_dir)
except ValueError:
    pass

# ==========================================
# IMPORTS
# ==========================================

from utils.logger_util import log_with_type

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
    log_with_type("info", "Engine(engin_main): Python engine started from Node bridge", "BRIDGE")

    # ==========================================
    # PARSE AI CONFIG
    # ==========================================

    ai_config = json.loads(
        ai_settings_json
    )

    log_with_type("info", "Engine(engin_main): AI config parsed successfully", "PIPELINE")

    # ==========================================
    # BUILD SHARED CONTEXT
    # ==========================================

    log_with_type(
        "info",
        f"Creating PipelineContext for input_file={input_file}",
        "PIPELINE"
    )

    context = PipelineContext(
        input_file=input_file,
        ai_config=ai_config,
        project_root=project_root
    )

    log_with_type("info", "Engine(engin_main): PipelineContext initialized", "PIPELINE")

    # ==========================================
    # START ORCHESTRATOR
    # ==========================================

    log_with_type("info", "Engine(engin_main): PipelineRunner initialized", "PIPELINE")

    log_with_type("info", "Engine(engin_main): Pipeline execution started", "PIPELINE")

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
