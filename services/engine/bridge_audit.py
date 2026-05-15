import sys
import os
import json
from audit_service import AuditService


def main():
    if len(sys.argv) < 2:
        print("ERROR | No transcript text provided", flush=True)
        sys.exit(1)

    transcript_text = sys.argv[1]

    try:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
        db_path = os.path.join(project_root, "retention_lab.db")

        audit_engine = AuditService(db_path)
        results = audit_engine.run_audit(transcript_text)

        if results is None:
            results = {}

        if not isinstance(results, dict):
            results = {"result": results}

        results["success"] = True

        print(json.dumps(results), flush=True)

    except Exception as e:
        error_payload = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_payload), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()