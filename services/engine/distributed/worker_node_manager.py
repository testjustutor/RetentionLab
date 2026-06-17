# root/services/engine/distributed/worker_node_manager.py

class WorkerNodeManager:

    """
    Tracks distributed workers.
    """

    WORKERS = {}

    # ==========================================
    # REGISTER
    # ==========================================

    @classmethod
    def register(
        cls,
        worker_id,
        metadata
    ):

        cls.WORKERS[
            worker_id
        ] = metadata

    # ==========================================
    # GET ALL
    # ==========================================

    @classmethod
    def all_workers(
        cls
    ):

        return cls.WORKERS