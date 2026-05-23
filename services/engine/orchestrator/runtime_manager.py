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

        print(
            f"[RUNTIME] Started: {task_name}",
            flush=True
        )

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

        print(
            f"[RUNTIME] Completed: {task_name} "
            f"({duration}s)",
            flush=True
        )

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

        print(
            f"[RUNTIME] Failed: {task_name}",
            flush=True
        )

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

        print(
            f"[RUNTIME] Pipeline completed "
            f"in {total_duration}s",
            flush=True
        )