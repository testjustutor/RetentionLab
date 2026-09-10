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

        # FIX: used to also call self.context.mark_task_started(task_name)
        # here, but every task handler ALSO calls that itself at its own
        # start (and must, since handlers run standalone outside the
        # orchestrator too - e.g. test_ai_evaluation.py). That meant every
        # task name was appended twice to execution_metadata["started_tasks"].
        # RuntimeManager's only job here is timing.

        self.active_tasks[
            task_name
        ] = time.time()

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

        # FIX: used to also call self.context.mark_task_completed(task_name)
        # here - but the task handler already called it itself just before
        # returning, so completed_tasks ended up with the task name TWICE
        # (once as a plain string from mark_task_completed, once more here)
        # plus this dict, giving 3 mixed-type entries per completed task.
        # completed_tasks stays a clean list of plain strings (owned solely
        # by mark_task_completed); the timing detail goes here instead.

        self.context.execution_metadata[
            "task_durations"
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

        # FIX: same double-append issue as task_completed() above - the task
        # handler's own except block already calls mark_task_failed(task_name)
        # before re-raising, so failed_tasks stays a clean list of plain
        # strings; the error/traceback detail goes here instead.

        self.context.execution_metadata[
            "task_failures"
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