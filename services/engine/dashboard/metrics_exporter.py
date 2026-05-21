import json


class MetricsExporter:

    """
    Exports metrics payloads.
    """

    @staticmethod
    def export(
        metrics,
        output_path
    ):

        with open(

            output_path,

            "w",

            encoding="utf-8"
        ) as file:

            json.dump(

                metrics,

                file,

                indent=4
            )