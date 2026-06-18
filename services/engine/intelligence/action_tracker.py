# services/engine/intelligence/action_tracker.py

class ActionTracker:

    """
    Tracks assigned actions.
    """

    @staticmethod
    def build(
        action_items
    ):

        actions = []

        for index, item in enumerate(
            action_items,
            start=1
        ):

            actions.append({

                "id": index,

                "text": item,

                "status": "open"
            })

        return actions