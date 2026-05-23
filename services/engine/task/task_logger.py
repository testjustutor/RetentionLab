from datetime import datetime


class TaskLogger:

    """
    Centralized pipeline logging utility.

    Provides:
    - standardized console output
    - task lifecycle tracking
    - execution timestamps
    - future extensibility for file logging
    """

    @staticmethod
    def timestamp():

        return datetime.utcnow().strftime(
            "%Y-%m-%d %H:%M:%S UTC"
        )

    # ==========================================
    # INFO
    # ==========================================

    @classmethod
    def info(cls, message):

        print(
            f"[INFO] [{cls.timestamp()}] {message}",
            flush=True
        )

    # ==========================================
    # SUCCESS
    # ==========================================

    @classmethod
    def success(cls, message):

        print(
            f"[SUCCESS] [{cls.timestamp()}] {message}",
            flush=True
        )

    # ==========================================
    # WARNING
    # ==========================================

    @classmethod
    def warning(cls, message):

        print(
            f"[WARNING] [{cls.timestamp()}] {message}",
            flush=True
        )

    # ==========================================
    # ERROR
    # ==========================================

    @classmethod
    def error(cls, message):

        print(
            f"[ERROR] [{cls.timestamp()}] {message}",
            flush=True
        )

    # ==========================================
    # TASK START
    # ==========================================

    @classmethod
    def task_started(cls, task_name):

        cls.info(
            f"TASK STARTED -> {task_name}"
        )

    # ==========================================
    # TASK COMPLETE
    # ==========================================

    @classmethod
    def task_completed(cls, task_name):

        cls.success(
            f"TASK COMPLETED -> {task_name}"
        )

    # ==========================================
    # TASK FAILED
    # ==========================================

    @classmethod
    def task_failed(cls, task_name, error):

        cls.error(
            f"TASK FAILED -> {task_name} | {str(error)}"
        )