import torch


class RuntimeGpuMonitor:

    """
    GPU runtime diagnostics.
    """

    @staticmethod
    def snapshot():

        if not torch.cuda.is_available():

            return {

                "gpu_available": False
            }

        allocated = torch.cuda.memory_allocated()

        reserved = torch.cuda.memory_reserved()

        return {

            "gpu_available": True,

            "device_name": torch.cuda.get_device_name(0),

            "allocated_mb": round(
                allocated / (
                    1024 * 1024
                ),
                2
            ),

            "reserved_mb": round(
                reserved / (
                    1024 * 1024
                ),
                2
            )
        }