from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed
)


class ParallelTaskManager:

    """
    Handles safe parallel execution
    for post-transcription AI tasks.

    Current Parallel Tasks:
    - intel
    - audit
    - summary
    - topics
    """

    def __init__(self, max_workers=4):

        self.max_workers = max_workers

    # ==========================================
    # EXECUTE TASK GROUP
    # ==========================================

    def execute(self, task_handlers):

        """
        task_handlers format:

        [
            ("audit", callable),
            ("summary", callable)
        ]
        """

        results = {}

        if not task_handlers:

            return results

        with ThreadPoolExecutor(
            max_workers=self.max_workers
        ) as executor:

            future_map = {

                executor.submit(
                    handler
                ): task_name

                for task_name, handler in task_handlers
            }

            for future in as_completed(future_map):

                task_name = future_map[future]

                try:

                    future.result()

                    results[task_name] = {
                        "success": True
                    }

                    print(
                        f"[PARALLEL TASK MANAGER] Completed: {task_name}",
                        flush=True
                    )

                except Exception as error:

                    results[task_name] = {
                        "success": False,
                        "error": str(error)
                    }

                    print(
                        f"[PARALLEL TASK MANAGER ERROR] {task_name}: {str(error)}",
                        flush=True
                    )

                    raise

        return results