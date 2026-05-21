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

        while True:

            ready_tasks = (
                self.graph.get_ready_tasks(
                    self.completed_tasks
                )
            )

            # ==========================================
            # EXIT CONDITION
            # ==========================================

            if not ready_tasks:

                break

            # ==========================================
            # SPLIT EXECUTION TYPES
            # ==========================================

            sequential_tasks, parallel_tasks = (

                self.graph.split_parallel_tasks(
                    ready_tasks
                )
            )

            # ==========================================
            # RUN SEQUENTIAL TASKS
            # ==========================================

            for task in sequential_tasks:

                self._execute_single_task(
                    task
                )

            # ==========================================
            # RUN PARALLEL TASKS
            # ==========================================

            if parallel_tasks:

                self._execute_parallel_tasks(
                    parallel_tasks
                )

    # ==========================================
    # SINGLE TASK EXECUTION
    # ==========================================

    def _execute_single_task(
        self,
        task
    ):

        task_name = task["task_name"]

        handler = task["handler"]

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

        except Exception as error:

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

            # ==========================================
            # WAIT FOR ALL
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

                except Exception as error:

                    self.runtime_manager.task_failed(
                        task_name,
                        error
                    )

                    raise

    # ==========================================
    # PARALLEL WRAPPER
    # ==========================================

    def _parallel_wrapper(
        self,
        task_name,
        handler
    ):

        return handler(
            self.context
        )