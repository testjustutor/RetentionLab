# root/services/engine/runtime/gpu_memory_cleaner.py

import gc
import torch


class GPUMemoryCleaner:

    """
    Releases RAM + GPU memory.
    """

    @staticmethod
    def cleanup():

        gc.collect()

        if torch.cuda.is_available():

            torch.cuda.empty_cache()