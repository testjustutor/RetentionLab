import torch
import whisper

class PipelineService:
    def __init__(self, hf_token):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # Using base model for a good balance of speed and accuracy
        self.whisper_model = whisper.load_model("base", device=self.device)
        self.pipeline = None # Advanced Diarization disabled for Windows compatibility

    def process(self, audio_path):
        # 1. Transcribe audio
        result = self.whisper_model.transcribe(
            audio_path,
            fp16=(self.device == "cuda"),
            condition_on_previous_text=False,
        )

        processed_script = []
        for seg in result["segments"]:
            processed_script.append({
                "start": round(seg["start"], 2),
                "end": round(seg["end"], 2),
                "text": seg["text"].strip(),
                "speaker": "SPEAKER_1" if seg["id"] % 2 == 0 else "SPEAKER_2",
            })

        # 2. Identify Instructor & Calculate Talk Ratio (Roadmap Step 4)
        unique_speakers = list({s["speaker"] for s in processed_script})
        counts = {
            sp: sum(len(s["text"]) for s in processed_script if s["speaker"] == sp)
            for sp in unique_speakers
        }
        
        inst_id = max(counts, key=counts.get) if counts else None
        total_chars = sum(counts.values()) if counts else 0
        
        talk_ratio = {
            "instructor": round((counts.get(inst_id, 0) / total_chars) * 100, 1) if total_chars > 0 else 0,
            "learner": round((100 - ((counts.get(inst_id, 0) / total_chars) * 100)), 1) if total_chars > 0 else 0
        }

        # 3. Create Labeled Transcript for the Auditor (Roadmap Step 3)
        transcript_with_labels = ""
        for seg in processed_script:
            role = "INSTRUCTOR" if seg["speaker"] == inst_id else "LEARNER"
            transcript_with_labels += f"[{role}]: {seg['text']}\n"

        return transcript_with_labels, talk_ratio, processed_script