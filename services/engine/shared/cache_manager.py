# root/services/engine/shared/cache_manager.py

import os
import shutil


class CacheManager:

    """
    Central cache utility manager.
    """

    @staticmethod
    def ensure_directory(path):

        os.makedirs(
            path,
            exist_ok=True
        )

    # ==========================================
    # CLEAR DIRECTORY
    # ==========================================

    @staticmethod
    def clear_directory(path):

        if not os.path.exists(path):

            return

        for item in os.listdir(path):

            item_path = os.path.join(
                path,
                item
            )

            try:

                if os.path.isfile(item_path):

                    os.remove(
                        item_path
                    )

                elif os.path.isdir(item_path):

                    shutil.rmtree(
                        item_path
                    )

            except Exception:

                pass

    # ==========================================
    # FILE EXISTS
    # ==========================================

    @staticmethod
    def exists(path):

        return os.path.exists(
            path
        )