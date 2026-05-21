class TaskDependencyResolver:

    """
    Validates task dependency execution.

    Example:
    - transcription depends on media
    - audit depends on transcription
    """

    @staticmethod
    def validate(context, task_name, task_registry):

        task_config = task_registry.get(
            task_name,
            {}
        )

        dependencies = task_config.get(
            "dependencies",
            []
        )

        if not dependencies:

            return True

        for dependency in dependencies:

            dependency_status = (
                context.task_status.get(
                    dependency
                )
            )

            if dependency_status != "completed":

                print(
                    f"[DEPENDENCY RESOLVER] "
                    f"Task '{task_name}' blocked by '{dependency}' "
                    f"(status={dependency_status})",
                    flush=True
                )

                return False

        return True