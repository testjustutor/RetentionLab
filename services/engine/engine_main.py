import sys
import os
import json
import torch
from media_service import MediaService
from pipeline_service import PipelineService
from audit_service import AuditService

def main():
    if len(sys.argv) < 2:
        print("ERROR: No input file provided.")
        sys.exit(1)

    input_file = sys.argv[1]
    
    engine_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(engine_dir, "../../"))
    db_path = os.path.join(project_root, "retention_lab.db")

    recording_path = os.path.join(project_root, "storage", "recordings", input_file)
    transcript_dir = os.path.join(project_root, "storage", "cache_audio_transcripts")
    audit_dir = os.path.join(project_root, "storage", "cache_audits")
    summary_dir = os.path.join(project_root, "storage", "summaries")

    os.makedirs(transcript_dir, exist_ok=True)
    os.makedirs(audit_dir, exist_ok=True)
    os.makedirs(summary_dir, exist_ok=True)

    filename_no_ext = os.path.splitext(input_file)[0]
    base_id = filename_no_ext.replace("REC_", "") if filename_no_ext.startswith("REC_") else filename_no_ext

    # Initialize return variables with defaults to avoid scope errors
    audio_path = ""
    transcript_path = ""
    audit_path = ""
    summary_path = ""
    oqi_score = 0
    audit_results = {}

    try:
        # 3. Process Media
        media_service = MediaService(project_root)
        audio_path = media_service.extract_audio(recording_path)

        # 4. Transcribe
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise ValueError("HF_TOKEN environment variable is missing.")
        
        pipeline = PipelineService(hf_token=hf_token)
        labeled_transcript = pipeline.process(audio_path)
        
        transcript_filename = f"TRANS_{base_id}.txt"
        transcript_path = os.path.join(transcript_dir, transcript_filename)
        with open(transcript_path, "w", encoding="utf-8") as f:
            f.write(labeled_transcript)

        # 5. Audit & Summary
        try:
            audit_engine = AuditService(db_path)
            audit_results = audit_engine.run_audit(labeled_transcript)
            oqi_score = audit_results.get("oqi_score", 0)
            
            # Generate Summary TEXT
            narrative_text = audit_engine.generate_summary(labeled_transcript, "")

            # Save Summary FILE
            summary_filename = f"SUMMARY_{base_id}.txt"
            summary_path = os.path.join(summary_dir, summary_filename)
            with open(summary_path, "w", encoding="utf-8") as f:
                f.write(narrative_text) # Corrected variable name and indentation

            # Save Audit JSON
            audit_filename = f"AUDIT_{base_id}.json"
            audit_path = os.path.join(audit_dir, audit_filename)
            with open(audit_path, "w", encoding="utf-8") as f:
                json.dump(audit_results, f, indent=4)
            
        except Exception as e:
            print(f"Audit skipped due to: {e}")
            summary_path = "N/A"

        # 6. Return Structured Data for Node.js
        print(json.dumps({
            "success": True,
            "meeting_id": base_id,
            "audio_path": audio_path,
            "transcript_path": transcript_path,
            "audit_json_path": audit_path,
            "summary_path": summary_path, # Returns the PATH string
            "oqi_score": oqi_score
        }))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()