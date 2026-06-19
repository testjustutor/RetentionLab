# root/services/engine/task/summary/summary_task.py

from utils.logger_util import log_with_type

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

    log_with_type("info", "Engine(task > topics > topics_task) : Topics task started", "TASK")

    try:

        service = TopicService()

        log_with_type("info", "Engine(task > topics > topics_task) : TopicService initialized", "TASK")

        topics = service.extract_topics(

            context.labeled_transcript
        )

        log_with_type("info", "Engine(task > topics > topics_task) : Topics extracted", "TASK")

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

        log_with_type("info", f"Engine(task > topics > topics_task) : Topics saved path={output_path}", "TASK")

        context.intel[
            "topics"
        ] = topics

        context.mark_task_completed(
            "topics"
        )

        log_with_type("info", "Engine(task > topics > topics_task) : Topics task completed", "TASK")

    except Exception:

        context.mark_task_failed(
            "topics"
        )

        log_with_type("error", f"Engine(task > topics > topics_task) : Topics task failed error={str(e)}", "TASK")

        raise