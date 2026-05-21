class TaskResultBuilder:

    """
    Builds standardized pipeline responses.

    Ensures:
    - stable Node.js bridge compatibility
    - future API compatibility
    - centralized response formatting
    """

    @staticmethod
    def build(context):

        return {

            # ==========================================
            # GLOBAL STATUS
            # ==========================================

            "success": True,

            "meeting_id": context.base_id,

            # ==========================================
            # GENERATED FILES
            # ==========================================

            "audio_path": context.audio_path,

            "transcript_path": context.transcript_path,

            "sentiment_path": context.sentiment_path,

            "vector_path": context.vector_path,

            "audit_json_path": context.audit_json_path,

            "summary_path": context.summary_path,

            # ==========================================
            # AI RESULTS
            # ==========================================

            "oqi_score": context.audit_results.get(
                "oqi_score",
                0
            ),

            # ==========================================
            # EXECUTION STATUS
            # ==========================================

            "task_status": context.task_status,

            "execution_metadata": context.execution_metadata,

            # ==========================================
            # OPTIONAL INTELLIGENCE
            # ==========================================

            "topics_generated": (
                context.intel.get("topics") is not None
            ),

            "sentiment_generated": (
                context.intel.get("sentiment") is not None
            ),

            "embeddings_generated": (
                context.intel.get("vectors") is not None
            )
        }