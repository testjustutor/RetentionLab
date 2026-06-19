# root/services/engine/distributed/distributed_scheduler.py

class DistributedScheduler:

    """
    Placeholder distributed scheduler.
    """

    @staticmethod
    def schedule(
        tasks,
        workers
    ):

        assignments = []

        if not workers:

            return assignments

        worker_ids = list(
            workers.keys()
        )

        index = 0

        for task in tasks:

            assignments.append({

                "task": task,

                "worker": (
                    worker_ids[index]
                )
            })

            index = (
                index + 1
            ) % len(worker_ids)

        return assignments