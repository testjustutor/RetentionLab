import time


class RuntimeMetricsCollector:

    """
    Collects execution timing metrics.
    """

    def __init__(self):

        self.active = {}

        self.completed = {}

    # ==========================================
    # START TIMER
    # ==========================================

    def start(
        self,
        task_name
    ):

        self.active[
            task_name
        ] = time.time()

    # ==========================================
    # STOP TIMER
    # ==========================================

    def stop(
        self,
        task_name
    ):

        if task_name not in self.active:

            return

        started = self.active[
            task_name
        ]

        duration = round(

            time.time() - started,

            2
        )

        self.completed[
            task_name
        ] = {

            "duration_seconds": duration
        }

    # ==========================================
    # EXPORT METRICS
    # ==========================================

    def export(self):

        return self.completed