import sys
import os
import json
import torch
from media_service import MediaService
from pipeline_service import PipelineService
from audit_service import AuditService

def main():
    # 1. Capture the filename passed from PythonBridge.js
    if len(sys.argv) < 2:
        print("ERROR: No input file provided.")
        sys.exit(1)

    input_file = sys.argv[1]
    
    # 2. Setup Paths (Relative to project root)
    # Assuming this script is in /service/engine/
    engine_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(engine_dir, "../../"))
    db_path = os.path.join(project_root, "transcripts.db")

    recording_path = os.path.join(project_root, "storage", "recordings", input_file)
    transcript_dir = os.path.join(project_root, "storage", "transcript")
    audit_dir = os.path.join(project_root, "storage", "audits")

    os.makedirs(transcript_dir, exist_ok=True)
    os.makedirs(audit_dir, exist_ok=True)

    filename_no_ext = os.path.splitext(input_file)[0]
    base_id = filename_no_ext.replace("REC_", "") if filename_no_ext.startswith("REC_") else filename_no_ext

    try:
        # 3. Process Media
        media_service = MediaService(project_root)
        # Result will be REC_{base_id}.wav
        audio_path = media_service.extract_audio(recording_path)

        # 4. Transcribe
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise ValueError("HF_TOKEN environment variable is missing. Please check your .env file.")
        
        pipeline = PipelineService(hf_token=hf_token)
        labeled_transcript = pipeline.process(audio_path)
        
        # Save as TRANS_{base_id}.txt
        transcript_filename = f"TRANS_{base_id}.txt"
        transcript_path = os.path.join(transcript_dir, transcript_filename)
        with open(transcript_path, "w", encoding="utf-8") as f:
            f.write(labeled_transcript)

        # 5. Audit (Optional - Skip if AuditService isn't required)
        audit_results = {}
        narrative_summary = "Summary generation skipped (AuditService disabled)."
        try:
            audit_engine = AuditService(db_path)
            audit_results = audit_engine.run_audit(labeled_transcript)
            narrative_summary = audit_engine.generate_summary(labeled_transcript, "")
        except Exception as e:
            print(f"Audit skipped due to: {e}")
        
        # Save as AUDIT_{base_id}.json
        audit_filename = f"AUDIT_{base_id}.json"
        audit_path = os.path.join(audit_dir, audit_filename)
        with open(audit_path, "w", encoding="utf-8") as f:
            json.dump(audit_results, f, indent=4)

        # 6. Return Structured Data for Node.js
        # The keys here match the fields in your MeetingAssetsModel.js
        print(json.dumps({
            "success": True,
            "meeting_id": base_id,
            "audio_path": audio_path,
            "transcript_path": transcript_path,
            "audit_json_path": audit_path,
            "summary": narrative_summary,
            "oqi_score": audit_results["oqi_score"]
        }))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()