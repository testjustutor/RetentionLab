# root/services/engine/orchestrator/execution_manager.py

from utils.logger_util import log_with_type

from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed
)

from services.engine.orchestrator.dependency_graph import (
    DependencyGraph
)


class ExecutionManager:

    """
    Core runtime execution engine.

    Responsible for:
    - dependency-aware execution
    - sequential task handling
    - safe parallel execution
    - runtime coordination
    """

    def __init__(
        self,
        context,
        runtime_manager
    ):

        self.context = context

        self.runtime_manager = (
            runtime_manager
        )

        self.graph = DependencyGraph(
            context
        )

        self.completed_tasks = set()

    # ==========================================
    # MAIN EXECUTION LOOP
    # ==========================================

    def execute(self):

        log_with_type("info", "Engine(orchestrator > execution_manager) : ExecutionManager loop started", "EXECUTION")

        while True:

            ready_tasks = (
                self.graph.get_ready_tasks(
                    self.completed_tasks
                )
            )

            log_with_type("info", f"Ready tasks fetched: {len(ready_tasks)}", "EXECUTION")

            # ==========================================
            # EXIT CONDITION
            # ==========================================

            if not ready_tasks:

                log_with_type("info", "Engine(orchestrator > execution_manager) : No ready tasks, exiting loop", "EXECUTION")

                break

            # ==========================================
            # SPLIT EXECUTION TYPES
            # ==========================================

            sequential_tasks, parallel_tasks = (
                self.graph.split_parallel_tasks(
                    ready_tasks
                )
            )

            log_with_type("info", f"Engine(orchestrator > execution_manager) : Sequential={len(sequential_tasks)} | Parallel={len(parallel_tasks)}", "EXECUTION")

            # ==========================================
            # RUN SEQUENTIAL TASKS
            # ==========================================


            for task in sequential_tasks:

                log_with_type("info", f"Engine(orchestrator > execution_manager) : SEQUENTIAL START -> {task['task_name']}", "TASK")

                self._execute_single_task(
                    task
                )

                log_with_type("info", f"Engine(orchestrator > execution_manager) : SEQUENTIAL DONE -> {task['task_name']}", "TASK")

            # ==========================================
            # RUN PARALLEL TASKS
            # ==========================================

            if parallel_tasks:

                log_with_type("info", f"Engine(orchestrator > execution_manager) : PARALLEL START -> {len(parallel_tasks)} tasks", "TASK")

                self._execute_parallel_tasks(
                    parallel_tasks
                )

                log_with_type("info", "Engine(orchestrator > execution_manager) : PARALLEL DONE", "TASK")

    # ==========================================
    # SINGLE TASK EXECUTION
    # ==========================================

    def _execute_single_task(
        self,
        task
    ):

        task_name = task["task_name"]

        handler = task["handler"]

        log_with_type("info", f"Engine(orchestrator > execution_manager) : TASK STARTED -> {task_name}", "TASK")


        self.runtime_manager.task_started(
            task_name
        )

        try:

            handler(
                self.context
            )

            self.completed_tasks.add(
                task_name
            )

            self.runtime_manager.task_completed(
                task_name
            )

            log_with_type("info", f"Engine(orchestrator > execution_manager) : TASK COMPLETED -> {task_name}", "TASK")

        except Exception as error:

            log_with_type("error", f"Engine(orchestrator > execution_manager) : TASK FAILED -> {task_name} | {str(error)}", "TASK")

            self.runtime_manager.task_failed(
                task_name,
                error
            )

            raise

    # ==========================================
    # PARALLEL EXECUTION
    # ==========================================

    def _execute_parallel_tasks(
        self,
        tasks
    ):

        log_with_type("info", f"Engine(orchestrator > execution_manager) : PARALLEL EXECUTION START -> {len(tasks)} tasks", "TASK")

        futures = {}

        with ThreadPoolExecutor(

            max_workers=len(tasks)

        ) as executor:

            for task in tasks:

                task_name = task[
                    "task_name"
                ]

                handler = task[
                    "handler"
                ]

                self.runtime_manager.task_started(
                    task_name
                )

                future = executor.submit(
                    self._parallel_wrapper,
                    task_name,
                    handler
                )

                futures[
                    future
                ] = task_name

                log_with_type("info", f"Engine(orchestrator > execution_manager) : Parallel task submitted={task_name}", "EXECUTION")

            # ==========================================
            # WAIT FOR ALL TASKS
            # ==========================================

            for future in as_completed(
                futures
            ):

                task_name = futures[
                    future
                ]

                try:

                    future.result()

                    self.completed_tasks.add(
                        task_name
                    )

                    self.runtime_manager.task_completed(
                        task_name
                    )

                    log_with_type("info", f"Engine(orchestrator > execution_manager) : Parallel task completed={task_name}", "EXECUTION")

                except Exception as error:

                    self.runtime_manager.task_failed(
                        task_name,
                        error
                    )

                    log_with_type("error", f"Engine(orchestrator > execution_manager) : Parallel task failed={task_name} error={str(error)}", "EXECUTION")

                    raise

    # ==========================================
    # PARALLEL WRAPPER
    # ==========================================

    def _parallel_wrapper(
        self,
        task_name,
        handler
    ):

        log_with_type("info", f"Engine(orchestrator > execution_manager) : Running parallel wrapper task={task_name}", "EXECUTION")

        return handler(
            self.context
        )