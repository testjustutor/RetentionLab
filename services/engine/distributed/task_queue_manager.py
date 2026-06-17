# root/services/engine/distributed/task_queue_manager.py

from queue import Queue


class TaskQueueManager:

    """
    Shared runtime queue.
    """

    QUEUE = Queue()

    # ==========================================
    # PUSH
    # ==========================================

    @classmethod
    def push(
        cls,
        task
    ):

        cls.QUEUE.put(task)

    # ==========================================
    # POP
    # ==========================================

    @classmethod
    def pop(
        cls
    ):

        if cls.QUEUE.empty():

            return None

        return cls.QUEUE.get()