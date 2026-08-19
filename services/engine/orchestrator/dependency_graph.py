# root/services/engine/orchestrator/dependency_graph.py

from utils.logger_util import log_with_type

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
    ├── audit
    ├── summary
    └── topics
        ↓
    persist_results
    """

    def __init__(self, context):

        self.context = context

        self.registry = TASK_REGISTRY

        log_with_type("info", "Engine(orchestrator > dependency_graph) : DependencyGraph initialized", "GRAPH")

    # ==========================================
    # PUBLIC GRAPH BUILD
    # ==========================================

    def build(self):

        executable_tasks = []

        log_with_type("info", "Engine(orchestrator > dependency_graph) : Building executable task graph", "GRAPH")

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
                log_with_type("info", f"Engine(orchestrator > dependency_graph) : Skipping task={task_name} (feature disabled)", "GRAPH")
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

            log_with_type("info", f"Engine(orchestrator > dependency_graph) : Task added={task_name}", "GRAPH")

        log_with_type("info", f"Engine(orchestrator > dependency_graph) : Build complete total_tasks={len(executable_tasks)}", "GRAPH")

        return executable_tasks

    # ==========================================
    # READY TASK RESOLUTION
    # ==========================================

    def get_ready_tasks(
        self,
        completed_tasks
    ):

        log_with_type("info", f"Engine(orchestrator > dependency_graph) : Resolving ready tasks completed_count={len(completed_tasks)}", "GRAPH")

        ready_tasks = []

        for task in self.build():

            task_name = task["task_name"]

            # already executed
            if task_name in completed_tasks:
                log_with_type("info", f"Engine(orchestrator > dependency_graph) : Skipping already executed task={task_name}", "GRAPH")
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

                log_with_type("info", f"Engine(orchestrator > dependency_graph) : Ready task={task_name}", "GRAPH")
            else:
                log_with_type("info", f"Engine(orchestrator > dependency_graph) : Waiting task={task_name} unmet_dependencies={dependencies}", "GRAPH")

        log_with_type("info", f"Engine(orchestrator > dependency_graph) : Ready tasks resolved count={len(ready_tasks)}", "GRAPH")

        return ready_tasks

    # ==========================================
    # PARALLEL TASK FILTER
    # ==========================================

    @staticmethod
    def split_parallel_tasks(tasks):

        sequential = []
        parallel = []

        log_with_type("info", f"Engine(orchestrator > dependency_graph) : Splitting tasks total={len(tasks)}", "GRAPH")

        for task in tasks:

            if task.get("parallel"):

                parallel.append(
                    task
                )
                log_with_type("info", f"Engine(orchestrator > dependency_graph) : Parallel task={task['task_name']}", "GRAPH")

            else:

                sequential.append(
                    task
                )
                log_with_type("info", f"Engine(orchestrator > dependency_graph) : Sequential task={task['task_name']}", "GRAPH")

        log_with_type("info", f"Engine(orchestrator > dependency_graph) : Split done sequential={len(sequential)} parallel={len(parallel)}", "GRAPH")

        return sequential, parallel