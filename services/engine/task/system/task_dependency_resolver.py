class TaskDependencyResolver:

    """
    Resolves dependency chains.
    """

    @staticmethod
    def dependencies_satisfied(
        task,
        completed_tasks
    ):

        dependencies = task.get(
            "dependencies",
            []
        )

        return all(

            dependency in completed_tasks

            for dependency in dependencies
        )