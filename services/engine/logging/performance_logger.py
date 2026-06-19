# services/engine/logging/performance_logger.py

import time


class PerformanceLogger:

    """
    Measures execution timings.
    """

    def __init__(self):

        self.started = None

    # ==========================================
    # START
    # ==========================================

    def start(self):

        self.started = time.time()

    # ==========================================
    # STOP
    # ==========================================

    def stop(self):

        if self.started is None:

            return 0

        return round(

            time.time() - self.started,

            2
        )