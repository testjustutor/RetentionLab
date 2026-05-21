import whisperx
import torch

audio_file = "./storage/recordings/cache_wav_audio/WAV_viu-weqt-ecv_Sess23_2026-05-08_11-10.wav"
device = "cpu"

print("Loading Whisper model...")
model = whisperx.load_model("base", device)

print("Transcribing...")
result = model.transcribe(audio_file)

print("Loading alignment model...")
model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=device)
result = whisperx.align(result["segments"], model_a, metadata, audio_file, device)

print("Loading diarization model...")
diarize_model = whisperx.DiarizationPipeline(device=device)
diarize_segments = diarize_model(audio_file)

print("Assigning speakers...")
final_result = whisperx.assign_word_speakers(diarize_segments, result)

for segment in final_result["segments"]:
    print(f"{segment['speaker']}: {segment['text']}")