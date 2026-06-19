# root/services/engine/dashboard/runtime_dashboard.py

from services.engine.runtime.runtime_dashboard import (
    RuntimeDashboard
)


class EngineDashboard:

    """
    Dashboard wrapper.
    """

    @staticmethod
    def build(
        context
    ):

        return RuntimeDashboard.build(
            context
        )