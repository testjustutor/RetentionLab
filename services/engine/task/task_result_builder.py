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
            # OPTIONAL OUTPUTS
            # ==========================================

            "topics_generated": (
                context.topics_data is not None
            )
        }