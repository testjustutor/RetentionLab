# root/services/engine/orchestrator/execution_graph.py

from utils.logger_util import log_with_type

from services.engine.orchestrator.dependency_graph import (
    DependencyGraph
)


class ExecutionGraph:

    """
    Converts dependency graph
    into executable runtime graph.
    """

    def __init__(self, context):

        self.context = context

        log_with_type("info", "Engine(orchestrator > execution_graph) : ExecutionGraph initialized", "GRAPH")

        self.graph = DependencyGraph(
            context
        )

        self.completed = set()

    # ==========================================
    # NEXT READY TASKS
    # ==========================================

    def next_tasks(self):

        tasks = self.graph.get_ready_tasks(self.completed)

        log_with_type("info", f"Engine(orchestrator > execution_graph) : Next tasks resolved count={len(tasks)}", "GRAPH")

        return tasks

    # ==========================================
    # MARK COMPLETED
    # ==========================================

    def mark_completed(
        self,
        task_name
    ):

        self.completed.add(
            task_name
        )
        log_with_type("info", f"Engine(orchestrator > execution_graph) : Task marked completed task={task_name}", "GRAPH")

    # ==========================================
    # SPLIT EXECUTION TYPES
    # ==========================================

    def split(
        self,
        tasks
    ):
        sequential, parallel = self.graph.split_parallel_tasks(tasks)

        log_with_type("info", f"Engine(orchestrator > execution_graph) : Split tasks sequential={len(sequential)} parallel={len(parallel)}", "GRAPH")

        return sequential, parallel