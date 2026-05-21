import os
import psutil


class RuntimeMemoryMonitor:

    """
    Runtime RAM monitoring.
    """

    @staticmethod
    def snapshot():

        process = psutil.Process(
            os.getpid()
        )

        memory = process.memory_info()

        return {

            "rss_mb": round(
                memory.rss / (
                    1024 * 1024
                ),
                2
            ),

            "vms_mb": round(
                memory.vms / (
                    1024 * 1024
                ),
                2
            )
        }