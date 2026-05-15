import sys
import os
from pipeline_service import PipelineService


def main():
    # MANDATORY: This forces Python to send text to Node.js every second
    # without waiting for the script to finish.
    sys.stdout.reconfigure(line_buffering=True)

    if len(sys.argv) < 2:
        print("ERROR | No audio path provided", flush=True)
        sys.exit(1)

    audio_path = sys.argv[1]
    hf_token = os.getenv("HF_TOKEN")

    print(f"--- Stage 2: AI Pipeline Starting ---", flush=True)
    print(f"Target File: {os.path.basename(audio_path)}", flush=True)

    try:
        # Loading phase (Whisper-only in this Windows build)
        print("[1/3] Status: Loading Whisper model...", flush=True)
        pipeline = PipelineService(hf_token=hf_token)

        # Processing phase
        print("[2/3] Status: Models Loaded. Starting AI Processing...", flush=True)
        print("Progress: 0% | Initiating audio analysis...", flush=True)

        labeled_transcript = pipeline.process(audio_path)

        print("Progress: 100% | AI analysis complete.", flush=True)
        print("[3/3] Status: Finalizing results...", flush=True)

        print(f"SUCCESS | {labeled_transcript}", flush=True)

    except Exception as e:
        print(f"ERROR | {str(e)}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

