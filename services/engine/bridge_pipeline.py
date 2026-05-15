import sys
import os
import json
from pipeline_service import PipelineService
import warnings
warnings.filterwarnings(
    "ignore",
    message=".*clean_up_tokenization_spaces.*",
    category=FutureWarning
)

def main():
    sys.stdout.reconfigure(line_buffering=True)

    if len(sys.argv) < 2:
        print("ERROR | No audio path provided", flush=True)
        sys.exit(1)

    audio_path = sys.argv[1]
    hf_token = os.getenv("HF_TOKEN")

    print("--- Stage 2: AI Pipeline Starting ---", flush=True)
    print(f"Target File: {os.path.basename(audio_path)}", flush=True)

    try:
        print("[1/3] Status: Loading Whisper model...", flush=True)
        pipeline = PipelineService(hf_token=hf_token)

        print("[2/3] Status: Models Loaded. Starting AI Processing...", flush=True)
        print("Progress: 0% | Initiating audio analysis...", flush=True)

        labeled_transcript, talk_ratio, diarization_data = pipeline.process(audio_path)

        print("Progress: 100% | AI analysis complete.", flush=True)
        print("[3/3] Status: Finalizing results...", flush=True)

        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        storage_root = os.path.join(project_root, "storage")

        transcript_dir = os.path.join(storage_root, "cache_audio_transcripts")
        diarization_dir = os.path.join(storage_root, "cache_diarization")
        voice_activity_dir = os.path.join(storage_root, "cache_voice_activity")

        os.makedirs(transcript_dir, exist_ok=True)
        os.makedirs(diarization_dir, exist_ok=True)
        os.makedirs(voice_activity_dir, exist_ok=True)

        base_name = os.path.splitext(os.path.basename(audio_path))[0]

        transcript_path = os.path.join(transcript_dir, f"TRANS_{base_name}.txt")
        diarization_path = os.path.join(diarization_dir, f"DIAR_{base_name}.json")
        talk_ratio_path = os.path.join(voice_activity_dir, f"RATIO_{base_name}.json")

        with open(transcript_path, "w", encoding="utf-8") as f:
            f.write(str(labeled_transcript))

        with open(diarization_path, "w", encoding="utf-8") as f:
            json.dump(diarization_data, f, indent=4)

        with open(talk_ratio_path, "w", encoding="utf-8") as f:
            json.dump(talk_ratio, f, indent=4)

        result = {
            "success": True,
            "audio_path": audio_path,
            "transcript_path": transcript_path,
            "diarization_path": diarization_path,
            "talk_ratio_path": talk_ratio_path,
        }

        print(json.dumps(result), flush=True)

    except Exception as e:
        print(f"ERROR | {str(e)}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()