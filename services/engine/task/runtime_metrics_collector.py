import time


class RuntimeMetricsCollector:

    """
    Tracks pipeline execution metrics.

    Useful for:
    - AI optimization
    - latency debugging
    - CPU bottleneck analysis
    - Whisper profiling
    - production observability
    """

    def __init__(self):

        self.task_timings = {}

    # ==========================================
    # START TIMER
    # ==========================================

    def start(self, task_name):

        self.task_timings[task_name] = {
            "started_at": time.time(),
            "completed_at": None,
            "duration_seconds": None
        }

    # ==========================================
    # STOP TIMER
    # ==========================================

    def stop(self, task_name):

        if task_name not in self.task_timings:

            return

        completed_at = time.time()

        started_at = self.task_timings[
            task_name
        ]["started_at"]

        duration = round(
            completed_at - started_at,
            2
        )

        self.task_timings[
            task_name
        ]["completed_at"] = completed_at

        self.task_timings[
            task_name
        ]["duration_seconds"] = duration

        print(
            f"[RUNTIME METRICS] "
            f"{task_name} completed in "
            f"{duration}s",
            flush=True
        )

    # ==========================================
    # EXPORT METRICS
    # ==========================================

    def export(self):

        return self.task_timings