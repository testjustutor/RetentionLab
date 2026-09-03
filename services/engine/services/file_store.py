# services/engine/services/file_store.py

import os


class FileStore:

    """
    Shared file writer utility.
    """

    @staticmethod
    def save_text(
        path,
        content
    ):

        os.makedirs(

            os.path.dirname(path),

            exist_ok=True
        )

        with open(

            path,

            "w",

            encoding="utf-8"
        ) as file:

            file.write(content)

    # ==========================================
    # READ TEXT
    # ==========================================

    @staticmethod
    def read_text(
        path
    ):

        with open(

            path,

            "r",

            encoding="utf-8"
        ) as file:

            return file.read()