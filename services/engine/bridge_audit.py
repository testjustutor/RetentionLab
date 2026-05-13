import sys, os, json
from audit_service import AuditService

def main():
    # Pass the transcript text as a command line argument 
    # (or read from a file if it's very long)
    transcript_text = sys.argv[1] 

    try:
        # IMPORTANT: ensure we use the project-root SQLite DB (the one used by Node: transcripts.db)
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
        DB_PATH = os.path.join(project_root, 'transcripts.db')
        audit_engine = AuditService(DB_PATH)


        results = audit_engine.run_audit(transcript_text)
        print(f"SUCCESS | {json.dumps(results)}")
    except Exception as e:
        print(f"ERROR | {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()