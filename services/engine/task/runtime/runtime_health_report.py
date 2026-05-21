from services.engine.task.runtime.runtime_memory_monitor import (
    RuntimeMemoryMonitor
)

from services.engine.task.runtime.runtime_gpu_monitor import (
    RuntimeGpuMonitor
)

from services.engine.task.cache.cache_metrics import (
    CacheMetrics
)


class RuntimeHealthReport:

    """
    Full runtime diagnostics snapshot.
    """

    @staticmethod
    def generate(context):

        return {

            "memory": (
                RuntimeMemoryMonitor.snapshot()
            ),

            "gpu": (
                RuntimeGpuMonitor.snapshot()
            ),

            "cache": (
                CacheMetrics.collect(
                    context
                )
            ),

            "task_status": (
                context.task_status
            ),

            "execution_metadata": (
                context.execution_metadata
            )
        }
