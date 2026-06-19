# root/services/engine/shared/runtime_logger.py

import logging
import sys


class RuntimeLogger:

    """
    Global runtime logger.
    """

    LOGGER = None

    @classmethod
    def get_logger(cls):

        if cls.LOGGER:

            return cls.LOGGER

        logger = logging.getLogger(
            "AI_ENGINE"
        )

        logger.setLevel(
            logging.INFO
        )

        handler = logging.StreamHandler(
            sys.stdout
        )

        formatter = logging.Formatter(

            "[%(asctime)s] "
            "[%(levelname)s] "
            "%(message)s"
        )

        handler.setFormatter(
            formatter
        )

        logger.addHandler(
            handler
        )

        cls.LOGGER = logger

        return logger