# root/services/engine/shared/path_resolver.py

import os


class PathResolver:

    """
    Shared storage path resolver.
    """

    @staticmethod
    def build(
        base,
        *paths
    ):

        return os.path.join(
            base,
            *paths
        )

    # ==========================================
    # NORMALIZE
    # ==========================================

    @staticmethod
    def normalize(path):

        return os.path.normpath(
            path
        )

    # ==========================================
    # ABSOLUTE
    # ==========================================

    @staticmethod
    def absolute(path):

        return os.path.abspath(
            path
        )