from services.engine.task.runtime.runtime_health_report import (
    RuntimeHealthReport
)


class RuntimeDashboard:

    """
    Aggregates runtime diagnostics.
    """

    @staticmethod
    def build(
        context
    ):

        return RuntimeHealthReport.generate(
            context
        )
