import torch


class GPUAllocator:

    """
    GPU memory utility.
    """

    @staticmethod
    def clear():

        if torch.cuda.is_available():

            torch.cuda.empty_cache()

    # ==========================================
    # GPU INFO
    # ==========================================

    @staticmethod
    def info():

        if not torch.cuda.is_available():

            return {

                "available": False
            }

        return {

            "available": True,

            "device": (
                torch.cuda.get_device_name(0)
            )
        }