import time


class TaskLogger:

    """
    Structured task logger.
    """

    @staticmethod
    def info(message):

        print(
            f"[INFO] {message}",
            flush=True
        )

    @staticmethod
    def success(message):

        print(
            f"[SUCCESS] {message}",
            flush=True
        )

    @staticmethod
    def error(message):

        print(
            f"[ERROR] {message}",
            flush=True
        )

    @staticmethod
    def task_started(task_name):

        print(
            f"[TASK STARTED] {task_name}",
            flush=True
        )

    @staticmethod
    def task_completed(task_name):

        print(
            f"[TASK COMPLETED] {task_name}",
            flush=True
        )

    @staticmethod
    def task_failed(
        task_name,
        error
    ):

        print(
            f"[TASK FAILED] "
            f"{task_name}: {str(error)}",
            flush=True
        )