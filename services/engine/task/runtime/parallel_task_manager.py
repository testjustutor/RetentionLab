from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed
)


class ParallelTaskManager:

    """
    Safe parallel execution manager.

    Handles:
    - threaded execution
    - exception bubbling
    - task synchronization
    """

    def __init__(
        self,
        max_workers=4
    ):

        self.max_workers = (
            max_workers
        )

    # ==========================================
    # EXECUTE PARALLEL TASKS
    # ==========================================

    def execute(
        self,
        task_handlers
    ):

        futures = {}

        with ThreadPoolExecutor(

            max_workers=self.max_workers

        ) as executor:

            for (
                task_name,
                handler
            ) in task_handlers:

                future = executor.submit(
                    handler
                )

                futures[
                    future
                ] = task_name

            for future in as_completed(
                futures
            ):

                task_name = futures[
                    future
                ]

                try:

                    future.result()

                except Exception as error:

                    raise RuntimeError(

                        f"Parallel task failed: "
                        f"{task_name}"

                    ) from error