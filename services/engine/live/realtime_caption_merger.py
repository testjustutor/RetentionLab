# services/engine/live/realtime_caption_merger.py

class RealtimeCaptionMerger:

    """
    Merges realtime captions.
    """

    @staticmethod
    def merge(
        captions
    ):

        merged = []

        previous = None

        for caption in captions:

            if caption != previous:

                merged.append(
                    caption
                )

            previous = caption

        return merged