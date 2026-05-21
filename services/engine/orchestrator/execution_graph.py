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

        self.graph = DependencyGraph(
            context
        )

        self.completed = set()

    # ==========================================
    # NEXT READY TASKS
    # ==========================================

    def next_tasks(self):

        return self.graph.get_ready_tasks(
            self.completed
        )

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

    # ==========================================
    # SPLIT EXECUTION TYPES
    # ==========================================

    def split(
        self,
        tasks
    ):

        return self.graph.split_parallel_tasks(
            tasks
        )