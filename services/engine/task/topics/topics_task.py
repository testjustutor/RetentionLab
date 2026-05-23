import os

from services.engine.topic_service.service import (
    TopicService
)

from services.engine.shared.json_store import (
    JsonStore
)


def run_topics_task(context):

    context.mark_task_started(
        "topics"
    )

    try:

        service = TopicService()

        topics = service.extract_topics(

            context.labeled_transcript
        )

        output_path = os.path.join(

            context.storage_paths[
                "cache_topic_trackers"
            ],

            f"TOPICS_{context.base_id}.json"
        )

        JsonStore.save(
            output_path,
            topics
        )

        context.intel[
            "topics"
        ] = topics

        context.mark_task_completed(
            "topics"
        )

    except Exception:

        context.mark_task_failed(
            "topics"
        )

        raise