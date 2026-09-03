# services/engine/orchestrator/pipeline_runner.py

from utils.logger_util import log_with_type

from services.engine.orchestrator.execution_graph import (
    ExecutionGraph
)

from services.engine.orchestrator.execution_manager import (
    ExecutionManager
)

from services.engine.orchestrator.runtime_manager import (
    RuntimeManager
)


class PipelineRunner:

    """
    Main orchestrator controller.
    """

    def __init__(self, context):

        self.context = context

        log_with_type("info", "Engine(orchestrator > pipeline_runner) : PipelineRunner initialized", "PIPELINE")

        self.runtime_manager = (
            RuntimeManager(
                context
            )
        )
        
        log_with_type("info", "Engine(orchestrator > pipeline_runner) : RuntimeManager created", "PIPELINE")

        self.execution_manager = (
            ExecutionManager(
                context,
                self.runtime_manager
            )
        )

        log_with_type("info", "Engine(orchestrator > pipeline_runner) : Next Page ExecutionManager created", "PIPELINE")

    # ==========================================
    # MAIN EXECUTION
    # ==========================================

    def execute(self):

        log_with_type("info", "Engine(orchestrator > pipeline_runner) : Pipeline execution started", "PIPELINE")

        self.execution_manager.execute()

        log_with_type("info", "Engine(orchestrator > pipeline_runner) : ExecutionManager finished execution", "PIPELINE")

        self.runtime_manager.complete_pipeline()

        log_with_type("info", "Engine(orchestrator > pipeline_runner) : RuntimeManager pipeline completion done", "PIPELINE")

        result = self.context.build_final_response()

        log_with_type("info", "Engine(orchestrator > pipeline_runner) : Final response built successfully", "PIPELINE")

        return result