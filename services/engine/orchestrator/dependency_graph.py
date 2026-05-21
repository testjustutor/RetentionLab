from services.engine.orchestrator.task_registry import (
    TASK_REGISTRY
)


class DependencyGraph:

    """
    Resolves task dependencies.

    Responsible for:
    - validating dependency chains
    - checking execution readiness
    - filtering enabled tasks
    - preparing executable graph

    Example:

    media
        ↓
    transcription
        ↓
    ├── intel
    ├── audit
    ├── summary
    └── topics
    """

    def __init__(self, context):

        self.context = context

        self.registry = TASK_REGISTRY

    # ==========================================
    # PUBLIC GRAPH BUILD
    # ==========================================

    def build(self):

        executable_tasks = []

        for task_name, metadata in self.registry.items():

            # ==========================================
            # FEATURE FLAG VALIDATION
            # ==========================================

            feature_flag = metadata.get(
                "feature_flag"
            )

            if not getattr(
                self.context,
                feature_flag,
                False
            ):

                continue

            executable_tasks.append({

                "task_name": task_name,

                "handler": metadata["handler"],

                "dependencies": metadata.get(
                    "dependencies",
                    []
                ),

                "parallel": metadata.get(
                    "parallel",
                    False
                )
            })

        return executable_tasks

    # ==========================================
    # READY TASK RESOLUTION
    # ==========================================

    def get_ready_tasks(
        self,
        completed_tasks
    ):

        ready_tasks = []

        for task in self.build():

            task_name = task["task_name"]

            # already executed
            if task_name in completed_tasks:

                continue

            dependencies = task.get(
                "dependencies",
                []
            )

            # ==========================================
            # CHECK DEPENDENCY COMPLETION
            # ==========================================

            dependencies_satisfied = all(

                dependency in completed_tasks

                for dependency in dependencies
            )

            if dependencies_satisfied:

                ready_tasks.append(
                    task
                )

        return ready_tasks

    # ==========================================
    # PARALLEL TASK FILTER
    # ==========================================

    @staticmethod
    def split_parallel_tasks(tasks):

        sequential = []

        parallel = []

        for task in tasks:

            if task.get("parallel"):

                parallel.append(
                    task
                )

            else:

                sequential.append(
                    task
                )

        return sequential, parallel