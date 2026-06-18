# services/engine/logging/structured_logger.py

import logging
import json


class StructuredLogger:

    """
    JSON structured logger.
    """

    @staticmethod
    def create():

        logger = logging.getLogger(
            "STRUCTURED_ENGINE"
        )

        logger.setLevel(
            logging.INFO
        )

        return logger

    # ==========================================
    # JSON LOG
    # ==========================================

    @staticmethod
    def log(
        logger,
        payload
    ):

        logger.info(

            json.dumps(
                payload
            )
        )