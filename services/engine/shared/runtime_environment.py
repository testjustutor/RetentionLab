import os
import torch
import platform


class RuntimeEnvironment:

    """
    Runtime environment inspector.
    """

    @staticmethod
    def export():

        return {

            "python_version": (
                platform.python_version()
            ),

            "platform": (
                platform.platform()
            ),

            "torch_version": (
                torch.__version__
            ),

            "cuda_available": (
                torch.cuda.is_available()
            ),

            "cwd": os.getcwd()
        }