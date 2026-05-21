import torch
import whisperx

class ModelManager:
    
    _shared_model = None

    def __init__(self):
        # Forced to CPU based on your step 1 environment deployment
        self.device = "cpu"
        self.compute_type = "int8" # Best performance profile for CPU execution
        
        if ModelManager._shared_model is None:

            ModelManager._shared_model = whisperx.load_model(
                "base",
                self.device,
                compute_type=self.compute_type
            )

        # Load the optimized WhisperX transcription model
        self.whisper_model = whisperx.load_model("base", self.device, compute_type=self.compute_type)
        print("[TRANSCRIPTION - MODEL] System Status: AI Weight Maps Initialized Successfully.", flush=True)

    def decode_audio(self, audio_path):
        print("[TRANSCRIPTION - STEP 1] Executing raw waveform neural processing via WhisperX...", flush=True)
        
        # Load audio into memory using WhisperX's built-in utility
        audio = whisperx.load_audio(audio_path)
        
        # Step 1: Transcribe audio track (fast batch mode)
        raw_result = self.whisper_model.transcribe(audio, batch_size=4)
        
        print("[TRANSCRIPTION - STEP 1] Progress: Base transcription complete. Loading alignment model...", flush=True)
        
        # Step 2: Load the specific alignment model for the detected language
        language_code = raw_result.get("language", "en")
        align_model, metadata = whisperx.load_align_model(language_code=language_code, device=self.device)
        
        print("[TRANSCRIPTION - STEP 1.5] Aligning phonemes to generate ultra-precise word timestamps...", flush=True)
        # Align the transcription segments text to the exact positions in the audio waveform
        aligned_result = whisperx.align(
            raw_result["segments"], 
            align_model, 
            metadata, 
            audio, 
            self.device, 
            return_char_alignments=False
        )
        
        print("[TRANSCRIPTION - STEP 1] Progress: Audio successfully converted to aligned segment chunks.", flush=True)
        return aligned_result