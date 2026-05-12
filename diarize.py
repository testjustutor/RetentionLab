# pip install faster-whisper
# pip install whisperx
# pip install torch
# pip install torchaudio
# pip install webrtcvad-wheels
# pip install librosa
# pip install resemblyzer --no-deps
# pip install spectralcluster
# pip install pydub

# pip install pyannote.audio

# TEST:
# python "C:\xampp\htdocs\video-conference-boat\Zoom-transcript\diarize.py" "C:\xampp\htdocs\video-conference-boat\Zoom-transcript\storage\recordings\REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3"

#  don not touch my above comment

import sys
import json
import time
import traceback
import numpy as np

from faster_whisper import WhisperModel
from resemblyzer import VoiceEncoder, preprocess_wav
from spectralcluster import SpectralClusterer

print("=" * 80)
print("NEW DIARIZE FILE LOADED")
print("=" * 80)

# =========================================================
# CHECK ARGUMENTS
# =========================================================

if len(sys.argv) < 2:

    print("NO AUDIO FILE PROVIDED")
    sys.exit(1)

audio_path = sys.argv[1]

print("AUDIO PATH:", audio_path)
print("START TIME:", time.strftime("%Y-%m-%d %H:%M:%S"))

# =========================================================
# LOAD WHISPER MODEL
# =========================================================

try:

    print("=" * 80)
    print("LOADING WHISPER MODEL...")
    print("=" * 80)

    model = WhisperModel(
        "tiny",                # use tiny for faster CPU testing
        device="cpu",
        compute_type="int8"
    )

    print("WHISPER MODEL LOADED")

except Exception as e:

    print("WHISPER LOAD ERROR")
    print(str(e))
    traceback.print_exc()

    sys.exit(1)

# =========================================================
# TRANSCRIBE AUDIO
# =========================================================

try:

    print("=" * 80)
    print("STARTING TRANSCRIPTION...")
    print("=" * 80)

    transcribe_start = time.time()

    segments, info = model.transcribe(
	    audio_path,
	    beam_size=1,
	    vad_filter=False,
	    condition_on_previous_text=False,
	    word_timestamps=False
	)

    print("TRANSCRIBE GENERATOR CREATED")

    segments = list(segments)

    transcribe_end = time.time()

    print("TRANSCRIPTION FINISHED")
    print("TRANSCRIPTION TIME:", round(transcribe_end - transcribe_start, 2), "seconds")

    print("DETECTED LANGUAGE:", info.language)
    print("LANGUAGE PROBABILITY:", info.language_probability)

    print("TOTAL TRANSCRIPT SEGMENTS:", len(segments))

except Exception as e:

    print("=" * 80)
    print("TRANSCRIPTION ERROR")
    print("=" * 80)

    print(str(e))
    traceback.print_exc()

    sys.exit(1)

# =========================================================
# NO SEGMENTS FOUND
# =========================================================

if len(segments) == 0:

    print("=" * 80)
    print("NO SPEECH DETECTED")
    print("=" * 80)

    print(json.dumps([]))
    sys.exit(0)

# =========================================================
# LOAD AUDIO
# =========================================================

try:

    print("=" * 80)
    print("LOADING AUDIO WAVEFORM...")
    print("=" * 80)

    wav_load_start = time.time()

    wav = preprocess_wav(audio_path)

    wav_load_end = time.time()

    print("AUDIO LOADED")
    print("WAVEFORM LENGTH:", len(wav))
    print("AUDIO LOAD TIME:", round(wav_load_end - wav_load_start, 2), "seconds")

except Exception as e:

    print("=" * 80)
    print("AUDIO LOAD ERROR")
    print("=" * 80)

    print(str(e))
    traceback.print_exc()

    sys.exit(1)

# =========================================================
# LOAD VOICE ENCODER
# =========================================================

try:

    print("=" * 80)
    print("LOADING VOICE ENCODER...")
    print("=" * 80)

    encoder = VoiceEncoder()

    print("VOICE ENCODER LOADED")

except Exception as e:

    print("=" * 80)
    print("VOICE ENCODER ERROR")
    print("=" * 80)

    print(str(e))
    traceback.print_exc()

    sys.exit(1)

# =========================================================
# PROCESS SEGMENTS
# =========================================================

segment_data = []
embeddings = []

print("=" * 80)
print("PROCESSING SEGMENTS...")
print("=" * 80)

for idx, seg in enumerate(segments):

    try:

        text = seg.text.strip()

        print("-" * 80)
        print(f"SEGMENT #{idx + 1}")

        if not text:

            print("EMPTY TEXT -> SKIPPED")
            continue

        print("START:", seg.start)
        print("END:", seg.end)
        print("TEXT:", text)

        start = int(seg.start * 16000)
        end = int(seg.end * 16000)

        print("SAMPLE START:", start)
        print("SAMPLE END:", end)

        clip = wav[start:end]

        print("CLIP LENGTH:", len(clip))

        # skip very short clips
        if len(clip) < 8000:

            print("SHORT CLIP -> SKIPPED")
            continue

        print("GENERATING EMBEDDING...")

        embed_start = time.time()

        embedding = encoder.embed_utterance(clip)

        embed_end = time.time()

        print("EMBEDDING GENERATED")
        print("EMBEDDING TIME:", round(embed_end - embed_start, 2), "seconds")

        embeddings.append(embedding)

        segment_data.append({
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": text
        })

        print("SEGMENT ADDED")

    except Exception as e:

        print("SEGMENT ERROR")
        print(str(e))
        traceback.print_exc()

# =========================================================
# EMBEDDING SUMMARY
# =========================================================

print("=" * 80)
print("EMBEDDING SUMMARY")
print("=" * 80)

print("TOTAL EMBEDDINGS:", len(embeddings))
print("TOTAL SEGMENT DATA:", len(segment_data))

# =========================================================
# NO VALID EMBEDDINGS
# =========================================================

if len(embeddings) == 0:

    print("=" * 80)
    print("NO VALID EMBEDDINGS FOUND")
    print("=" * 80)

    print(json.dumps([]))
    sys.exit(0)

# =========================================================
# SPEAKER CLUSTERING
# =========================================================

if len(embeddings) < 2:

    print("=" * 80)
    print("ONLY ONE SPEAKER DETECTED")
    print("=" * 80)

    labels = [0] * len(embeddings)

else:

    try:

        print("=" * 80)
        print("RUNNING SPEAKER CLUSTERING...")
        print("=" * 80)

        cluster_start = time.time()

        clusterer = SpectralClusterer(
            min_clusters=2,
            max_clusters=5
        )

        labels = clusterer.predict(np.array(embeddings))

        cluster_end = time.time()

        print("CLUSTERING FINISHED")
        print("CLUSTERING TIME:", round(cluster_end - cluster_start, 2), "seconds")

        print("LABELS:", labels)

    except Exception as e:

        print("=" * 80)
        print("CLUSTER ERROR")
        print("=" * 80)

        print(str(e))
        traceback.print_exc()

        labels = [0] * len(embeddings)

# =========================================================
# BUILD FINAL JSON
# =========================================================

print("=" * 80)
print("BUILDING FINAL RESULTS...")
print("=" * 80)

results = []

for i, seg in enumerate(segment_data):

    try:

        results.append({
            "speaker": f"SPEAKER_{labels[i]:02d}",
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"]
        })

    except Exception as e:

        print("RESULT BUILD ERROR:", str(e))

print("=" * 80)
print("FINAL RESULT COUNT:", len(results))
print("=" * 80)

print(json.dumps(results, indent=2))

print("=" * 80)
print("SCRIPT FINISHED")
print("=" * 80)