import torch
import whisper

class ModelManager:
    def __init__(self):
        # Step 1: Detect and allocate hardware resources
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[TRANSCRIPTION - MODEL] System Allocation: Binding core to '{self.device.upper()}'.", flush=True)
        
        # Step 2: Pre-load model weights into active memory
        print("[TRANSCRIPTION - MODEL] System Status: Pre-loading Whisper 'base' tokens into RAM...", flush=True)
        self.whisper_model = whisper.load_model("base", device=self.device)
        print("[TRANSCRIPTION - MODEL] System Status: AI Weight Maps Initialized Successfully.", flush=True)

    def decode_audio(self, audio_path):
        print("[TRANSCRIPTION - STEP 1] Executing raw waveform neural processing via Whisper...", flush=True)
        
        # Step 3: Transcribe audio track with optimized settings
        result = self.whisper_model.transcribe(
            audio_path,
            fp16=(self.device == "cuda"),
            condition_on_previous_text=False,
            word_timestamps=True
        )
        print("[TRANSCRIPTION - STEP 1] Progress: Audio successfully converted to raw segment chunks.", flush=True)
        return result