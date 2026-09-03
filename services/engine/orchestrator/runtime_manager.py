# services/engine/orchestrator/runtime_manager.py

from utils.logger_util import log_with_type

import time
import traceback


class RuntimeManager:

    """
    Central runtime lifecycle manager.

    Tracks:
    - task durations
    - runtime metadata
    - execution failures
    - runtime metrics
    """

    def __init__(self, context):

        self.context = context

        self.pipeline_started_at = (
            time.time()
        )

        self.active_tasks = {}

        log_with_type("info", "Engine(orchestrator > runtime_manager) : RuntimeManager initialized", "RUNTIME")

    # ==========================================
    # TASK STARTED
    # ==========================================

    def task_started(
        self,
        task_name
    ):

        self.active_tasks[
            task_name
        ] = time.time()

        self.context.mark_task_started(
            task_name
        )

        log_with_type("info", f"Engine(orchestrator > runtime_manager) : Task started={task_name}", "RUNTIME")

    # ==========================================
    # TASK COMPLETED
    # ==========================================

    def task_completed(
        self,
        task_name
    ):

        started_at = self.active_tasks.get(
            task_name
        )

        duration = 0

        if started_at:

            duration = round(
                time.time() - started_at,
                2
            )

        self.context.mark_task_completed(
            task_name
        )

        self.context.execution_metadata[
            "completed_tasks"
        ].append({

            "task": task_name,

            "duration_seconds": duration
        })

        log_with_type("info", f"Engine(orchestrator > runtime_manager) : Task completed={task_name} duration={duration}s", "RUNTIME")

    # ==========================================
    # TASK FAILED
    # ==========================================

    def task_failed(
        self,
        task_name,
        error
    ):

        self.context.mark_task_failed(
            task_name
        )

        self.context.execution_metadata[
            "failed_tasks"
        ].append({

            "task": task_name,

            "error": str(error),

            "traceback": traceback.format_exc()
        })

        log_with_type("error", f"Engine(orchestrator > runtime_manager) : Task failed={task_name} error={str(error)}", "RUNTIME")

    # ==========================================
    # PIPELINE COMPLETE
    # ==========================================

    def complete_pipeline(self):

        total_duration = round(

            time.time()
            - self.pipeline_started_at,

            2
        )

        self.context.execution_metadata[
            "pipeline_duration_seconds"
        ] = total_duration

        log_with_type("info", f"Engine(orchestrator > runtime_manager) : Pipeline completed duration={total_duration}s", "RUNTIME")