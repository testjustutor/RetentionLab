class TaskResultBuilder:

    """
    Final response payload builder.
    """

    @staticmethod
    def build(context):

        return {

            "success": True,

            "meeting_id": context.base_id,

            "audio_path": context.audio_path,

            "transcript_path": context.transcript_path,

            "sentiment_path": context.sentiment_path,

            "vector_path": context.vector_path,

            "audit_json_path": context.audit_json_path,

            "summary_path": context.summary_path,

            "oqi_score": context.audit_results.get(
                "oqi_score",
                0
            ),

            "execution_metadata": (
                context.execution_metadata
            ),

            "task_status": (
                context.task_status
            )
        }