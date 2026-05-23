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

        self.runtime_manager = (
            RuntimeManager(
                context
            )
        )

        self.execution_manager = (
            ExecutionManager(
                context,
                self.runtime_manager
            )
        )

    # ==========================================
    # MAIN EXECUTION
    # ==========================================

    def execute(self):

        self.execution_manager.execute()

        self.runtime_manager.complete_pipeline()

        return self.context.build_final_response()