from services.engine.orchestrator.runtime_state_manager import (
    RuntimeStateManager
)

from services.engine.orchestrator.pipeline_bootstrap import (
    PipelineBootstrap
)


class PipelineRuntime:

    """
    Global runtime controller.

    Combines:
    - runtime state management
    - metrics initialization
    - cache bootstrapping
    - future distributed orchestration

    Designed for:
    - production AI systems
    - websocket monitoring
    - queue workers
    - microservice orchestration
    """

    def __init__(self, context):

        self.context = context

        self.state_manager = (
            RuntimeStateManager()
        )

        self.bootstrap = (
            PipelineBootstrap(
                context
            )
        )

        self.metrics = None

    # ==========================================
    # INITIALIZE RUNTIME
    # ==========================================

    def initialize(self):

        self.state_manager.register_pipeline(
            self.context.base_id
        )

        self.metrics = (
            self.bootstrap.initialize()
        )

        print(
            f"[PIPELINE RUNTIME] Runtime initialized for "
            f"{self.context.base_id}",
            flush=True
        )

    # ==========================================
    # TASK STARTED
    # ==========================================

    def task_started(
        self,
        task_name
    ):

        self.state_manager.set_active_task(
            self.context.base_id,
            task_name
        )

        self.metrics.start(
            task_name
        )

    # ==========================================
    # TASK COMPLETED
    # ==========================================

    def task_completed(
        self,
        task_name
    ):

        self.state_manager.mark_completed(
            self.context.base_id,
            task_name
        )

        self.metrics.stop(
            task_name
        )

    # ==========================================
    # TASK FAILED
    # ==========================================

    def task_failed(
        self,
        task_name
    ):

        self.state_manager.mark_failed(
            self.context.base_id,
            task_name
        )

        self.metrics.stop(
            task_name
        )

    # ==========================================
    # PIPELINE COMPLETED
    # ==========================================

    def complete(self):

        self.state_manager.complete_pipeline(
            self.context.base_id
        )

        self.context.execution_metadata[
            "runtime_metrics"
        ] = self.metrics.export()

        print(
            f"[PIPELINE RUNTIME] Pipeline completed for "
            f"{self.context.base_id}",
            flush=True
        )