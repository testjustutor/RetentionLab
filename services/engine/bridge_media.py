import sys
import os
import time
import subprocess
from media_service import MediaService

def main():
    # Force stdout to be unbuffered (alternative to -u flag)
    # This ensures "every second" updates work perfectly
    sys.stdout.reconfigure(line_buffering=True)

    if len(sys.argv) < 2:
        print("ERROR | No input file provided", flush=True)
        sys.exit(1)

    input_file = sys.argv[1]
    engine_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(engine_dir, "../../"))
    input_path = os.path.join(project_root, "storage", "recordings", input_file)

    print(f"Stage 1: Processing media file: {input_file}...", flush=True)

    try:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"File not found at: {input_path}")

        media_service = MediaService(project_root)
        
        if input_file.lower().endswith(".mp4"):
            print("Action: Detected .mp4 - Extracting audio to .wav...", flush=True)
            # The extract_audio method should ideally print its own progress inside, 
            # but we show a start message here.
            output_path = media_service.extract_audio(input_path)
            print("Action: Extraction complete.", flush=True)
        else:
            print("Action: Detected .mp3 - Skipping extraction.", flush=True)
            output_path = input_path
        
        # Crucial: Final success line for Node.js to resolve the Promise
        print(f"SUCCESS | {output_path}", flush=True)

    except Exception as e:
        print(f"ERROR | {str(e)}", flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()