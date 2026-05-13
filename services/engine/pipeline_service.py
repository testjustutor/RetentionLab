import torch
import whisper


class PipelineService:
    def __init__(self, hf_token):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # Whisper is independent of HF + torchcodec
        self.whisper_model = whisper.load_model("base", device=self.device)


        # Pyannote diarization (disabled by default on this Windows setup)
        # torchcodec DLL loading is failing in your environment, so diarization
        # would crash and stop the whole pipeline.
        self.pipeline = None

    def process(self, audio_path):
        # Whisper Transcribe
        result = self.whisper_model.transcribe(
            audio_path,
            fp16=(self.device == "cuda"),
            condition_on_previous_text=False,
        )

        processed_script = []
        for seg in result["segments"]:
            processed_script.append(
                {
                    "start": seg["start"],
                    "text": seg["text"].strip(),
                    "speaker": "SPEAKER_1" if seg["id"] % 2 == 0 else "SPEAKER_2",
                }
            )

        # Identify Instructor (heuristic: speaker with highest total character count)
        unique_speakers = list({s["speaker"] for s in processed_script if s["speaker"] != "UNKNOWN"})
        counts = {
            sp: sum(len(s["text"]) for s in processed_script if s["speaker"] == sp)
            for sp in unique_speakers
        }
        inst_id = max(counts, key=counts.get) if counts else None

        transcript_with_labels = ""
        for seg in processed_script:
            role = "INSTRUCTOR" if seg["speaker"] == inst_id else "LEARNER"
            transcript_with_labels += f"{role}: {seg['text']}\n"

        return transcript_with_labels

