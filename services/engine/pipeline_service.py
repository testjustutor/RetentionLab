import torch
import whisper
import datetime
from pyannote.audio import Pipeline

class PipelineService:
    def __init__(self, hf_token):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # --- FROM COLAB CELL 5 CONFIG ---
        self.whisper_model = whisper.load_model("base", device=self.device)
        self.pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", token=hf_token
        )
        if self.device == "cuda":
            self.pipeline.to(torch.device("cuda"))

    def process(self, audio_path):
        # --- FROM COLAB CELL 5 LOGIC ---
        # Whisper Transcribe
        result = self.whisper_model.transcribe(audio_path, fp16=(self.device=="cuda"), condition_on_previous_text=False)
        
        # Pyannote Diarization
        diarization = self.pipeline(audio_path, num_speakers=2)

        speaker_map = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speaker_map.append({"start": turn.start, "end": turn.end, "label": speaker})

        processed_script = []
        for seg in result['segments']:
            # Assign speaker based on timestamp
            speaker_id = "UNKNOWN"
            for s_map in speaker_map:
                if s_map["start"] <= seg['start'] <= s_map["end"]:
                    speaker_id = s_map["label"]
                    break
            processed_script.append({"start": seg['start'], "text": seg['text'].strip(), "speaker": speaker_id})

            # Identify Instructor (highest word count logic)
        unique_speakers = list(set(s['speaker'] for s in processed_script if s['speaker'] != "UNKNOWN"))
        counts = {sp: sum(len(s['text']) for s in processed_script if s['speaker'] == sp) for sp in unique_speakers}
        inst_id = max(counts, key=counts.get) if counts else None

        transcript_with_labels = ""
        for seg in processed_script:
            role = "INSTRUCTOR" if seg['speaker'] == inst_id else "LEARNER"
            transcript_with_labels += f"{role}: {seg['text']}\n"
            
        return transcript_with_labels