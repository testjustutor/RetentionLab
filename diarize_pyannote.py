
# pip install torch
# pip install faster-whisper
# pip install pyannote.audio
# pip install soundfile
# pip install torchaudio
# pip install librosa soundfile
# pip install requests

# $env:HF_TOKEN="hf_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; python "C:\xampp\htdocs\video-conference-boat\Zoom-transcript\diarize_pyannote.py" "C:\xampp\htdocs\video-conference-boat\Zoom-transcript\storage\recordings\REC_viu-weqt-ecv_Sess23_2026-05-08_11-10.mp3"
# 
# Do not touch my above comment, please ignore

# pip install transformers
# pip install sentence-transformers
# pip install librosa
# pip install soundfile
# pip install numpy
# pip install scipy
# pip install textblob
# pip install nltk
# pip install vaderSentiment
# pip install scikit-learn
# pip install pandas
# pip install openai

import os
import sys
import json
import warnings
import traceback
import requests
import concurrent.futures
from datetime import datetime, timedelta
from bisect import bisect_left

import torch
import torchaudio

from faster_whisper import WhisperModel
from pyannote.audio import Pipeline

# =========================================================
# CONFIG
# =========================================================

os.environ["TORCHAUDIO_BACKEND"] = "soundfile"
warnings.filterwarnings("ignore")

WHISPER_MODEL_SIZE = "tiny"
WHISPER_BEAM_SIZE  = 1             # greedy on CPU = fastest
CPU_THREADS        = 8             # set to your physical core count
MIN_WAV_BYTES      = 1_000

# =========================================================
# RUBRIC — all 108 micro indicators
# Structure: macro → meso → micro
# score_type: "binary" | "3pt"
# ai_scorable: True = AI scores it | False = human-only (AI skips)
# gate: True = fatal error / escalation trigger
# =========================================================

RUBRIC = {
    "A": {
        "label": "Instructional Quality & Pedagogy",
        "weight": 0.22,
        "meso": {
            "A1": {
                "label": "Lesson Structuring & Flow", "weight": 0.25,
                "micro": [
                    {"id": "A1.1", "text": "Lesson opening clearly states purpose or objective", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "A1.2", "text": "Instruction follows a logical sequence", "score_type": "3pt", "ai": True, "gate": False},
                    {"id": "A1.3", "text": "Practice activities align to instruction", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "A1.4", "text": "Session includes a meaningful closure", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
            "A2": {
                "label": "Instructional Strategies & Methods", "weight": 0.30,
                "micro": [
                    {"id": "A2.1", "text": "Uses at least one evidence-based strategy", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "A2.2", "text": "Modeling precedes guided practice", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "A2.3", "text": "Strategy selection matches learning objective", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "A2.4", "text": "Adjusts strategy based on learner response", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
            "A3": {
                "label": "Concept Explanation & Modeling", "weight": 0.25,
                "micro": [
                    {"id": "A3.1", "text": "Explanations are accurate and clear", "score_type": "binary", "ai": True, "gate": True},
                    {"id": "A3.2", "text": "Examples are age and level appropriate", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "A3.3", "text": "Uses think-alouds or worked examples", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "A3.4", "text": "Avoids unnecessary cognitive overload", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
            "A4": {
                "label": "Differentiation & Scaffolding", "weight": 0.20,
                "micro": [
                    {"id": "A4.1", "text": "Instruction adjusted to learner level", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "A4.2", "text": "Uses prompts or cues to support learning", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "A4.3", "text": "Gradual release of responsibility observed", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "A4.4", "text": "Additional support provided when learner struggles", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
        }
    },
    "B": {
        "label": "Curriculum Alignment & Accuracy",
        "weight": 0.15,
        "meso": {
            "B1": {
                "label": "Alignment to Curriculum Standards", "weight": 0.25,
                "micro": [
                    {"id": "B1.1", "text": "Objective aligns to stated curriculum", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "B1.2", "text": "Lesson content matches scope and sequence", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "B1.3", "text": "No off-grade or irrelevant content introduced", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
            "B2": {
                "label": "Content Accuracy & Academic Integrity", "weight": 0.30,
                "micro": [
                    {"id": "B2.1", "text": "No factual or conceptual errors present", "score_type": "binary", "ai": True, "gate": True},
                    {"id": "B2.2", "text": "Terminology used correctly", "score_type": "binary", "ai": True, "gate": True},
                    {"id": "B2.3", "text": "Corrects own mistakes if they occur", "score_type": "3pt", "ai": False, "gate": True},
                ]
            },
            "B3": {
                "label": "Depth vs Breadth Appropriateness", "weight": 0.20,
                "micro": [
                    {"id": "B3.1", "text": "Adequate depth for learner level", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "B3.2", "text": "Avoids unnecessary digressions", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "B3.3", "text": "Maintains focus on core objective", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
            "B4": {
                "label": "Task & Material Alignment", "weight": 0.25,
                "micro": [
                    {"id": "B4.1", "text": "Tasks directly support learning objective", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "B4.2", "text": "Materials are grade-appropriate", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "B4.3", "text": "Resources used effectively", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
        }
    },
    "C": {
        "label": "Learner Engagement & Responsiveness",
        "weight": 0.14,
        "meso": {
            "C1": {
                "label": "Cognitive Engagement", "weight": 0.25,
                "micro": [
                    {"id": "C1.1", "text": "Learner required to think or respond", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "C1.2", "text": "Questions promote reasoning", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "C1.3", "text": "Opportunities for application provided", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
            "C2": {
                "label": "Behavioral Engagement", "weight": 0.25,
                "micro": [
                    {"id": "C2.1", "text": "Learner remains mostly on-task", "score_type": "3pt", "ai": True, "gate": False},
                    {"id": "C2.2", "text": "Instructor monitors engagement", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "C2.3", "text": "Off-task behavior addressed appropriately", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
            "C3": {
                "label": "Emotional & Motivational Engagement", "weight": 0.25,
                "micro": [
                    {"id": "C3.1", "text": "Positive reinforcement used", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "C3.2", "text": "Instructor tone is encouraging", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "C3.3", "text": "Responds appropriately to learner frustration", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
            "C4": {
                "label": "Responsiveness to Learner Input", "weight": 0.25,
                "micro": [
                    {"id": "C4.1", "text": "Acknowledges learner responses", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "C4.2", "text": "Adjusts instruction based on input", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "C4.3", "text": "Follows up on incorrect responses", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
        }
    },
    "D": {
        "label": "Assessment & Feedback Quality",
        "weight": 0.12,
        "meso": {
            "D1": {
                "label": "Formative Assessment Practices", "weight": 0.25,
                "micro": [
                    {"id": "D1.1", "text": "Checks for understanding embedded in instruction", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "D1.2", "text": "Questions or tasks used diagnostically", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "D1.3", "text": "Assessment aligned to objective", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
            "D2": {
                "label": "Feedback Quality & Specificity", "weight": 0.25,
                "micro": [
                    {"id": "D2.1", "text": "Feedback is timely", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "D2.2", "text": "Feedback is specific and actionable", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "D2.3", "text": "Feedback focuses on process not just correctness", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
            "D3": {
                "label": "Error Handling & Misconception Addressal", "weight": 0.25,
                "micro": [
                    {"id": "D3.1", "text": "Errors identified correctly", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "D3.2", "text": "Misconceptions explicitly addressed", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "D3.3", "text": "Corrective feedback is respectful", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
            "D4": {
                "label": "Progress Monitoring", "weight": 0.25,
                "micro": [
                    {"id": "D4.1", "text": "Tracks learner performance during session", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "D4.2", "text": "Adjusts pacing based on progress", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "D4.3", "text": "Uses evidence to guide next steps", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
        }
    },
    "E": {
        "label": "Classroom Management & Pacing",
        "weight": 0.10,
        "meso": {
            "E1": {
                "label": "Time Management & Pacing", "weight": 0.25,
                "micro": [
                    {"id": "E1.1", "text": "Pacing appropriate for learner", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "E1.2", "text": "Time allocated proportionally to activities", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "E1.3", "text": "No prolonged idle time observed", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
            "E2": {
                "label": "Session Control & Structure", "weight": 0.25,
                "micro": [
                    {"id": "E2.1", "text": "Instructor maintains control of session", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "E2.2", "text": "Clear directions provided", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "E2.3", "text": "Manages disruptions effectively", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
            "E3": {
                "label": "Transitions & Momentum", "weight": 0.25,
                "micro": [
                    {"id": "E3.1", "text": "Smooth transitions between activities", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "E3.2", "text": "Maintains instructional momentum", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "E3.3", "text": "Minimizes downtime", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
            "E4": {
                "label": "Use of Instructional Time", "weight": 0.25,
                "micro": [
                    {"id": "E4.1", "text": "Instructional time maximized", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "E4.2", "text": "Minimal off-task or non-instructional talk", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "E4.3", "text": "Administrative tasks minimized", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
        }
    },
    "F": {
        "label": "Communication & Language Use",
        "weight": 0.10,
        "meso": {
            "F1": {
                "label": "Clarity of Oral Communication", "weight": 0.25,
                "micro": [
                    {"id": "F1.1", "text": "Speech is clear and audible", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "F1.2", "text": "Instructions are concise", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "F1.3", "text": "Rephrases when learner is confused", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
            "F2": {
                "label": "Language Appropriateness", "weight": 0.25,
                "micro": [
                    {"id": "F2.1", "text": "Vocabulary appropriate for learner level", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "F2.2", "text": "Avoids unnecessary jargon", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "F2.3", "text": "Adjusts language based on learner", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
            "F3": {
                "label": "Questioning Techniques", "weight": 0.25,
                "micro": [
                    {"id": "F3.1", "text": "Uses open-ended questions", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "F3.2", "text": "Provides adequate wait time", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "F3.3", "text": "Probes learner thinking", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
            "F4": {
                "label": "Listening & Turn-Taking", "weight": 0.25,
                "micro": [
                    {"id": "F4.1", "text": "Listens without unnecessary interruption", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "F4.2", "text": "Allows learner sufficient talk time", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "F4.3", "text": "Responds appropriately to learner cues", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
        }
    },
    "G": {
        "label": "Professionalism & Compliance",
        "weight": 0.09,
        "meso": {
            "G1": {
                "label": "Professional Conduct & Demeanor", "weight": 0.34,
                "micro": [
                    {"id": "G1.1", "text": "Maintains respectful tone throughout", "score_type": "binary", "ai": True, "gate": True},
                    {"id": "G1.2", "text": "Demonstrates patience", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "G1.3", "text": "Maintains appropriate body language", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
            "G2": {
                "label": "Policy & Platform Compliance", "weight": 0.33,
                "micro": [
                    {"id": "G2.1", "text": "Uses platform tools correctly", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "G2.2", "text": "Follows session protocols", "score_type": "binary", "ai": True, "gate": True},
                    {"id": "G2.3", "text": "No prohibited actions observed", "score_type": "binary", "ai": True, "gate": True},
                ]
            },
            "G3": {
                "label": "Ethical & Safe Practices", "weight": 0.33,
                "micro": [
                    {"id": "G3.1", "text": "Learner safety and well-being maintained", "score_type": "binary", "ai": True, "gate": True},
                    {"id": "G3.2", "text": "No inappropriate content or behavior", "score_type": "binary", "ai": True, "gate": True},
                    {"id": "G3.3", "text": "Handles sensitive situations appropriately", "score_type": "3pt", "ai": False, "gate": True},
                ]
            },
        }
    },
    "H": {
        "label": "Learning Outcomes & Evidence",
        "weight": 0.08,
        "meso": {
            "H1": {
                "label": "Objective Attainment", "weight": 0.34,
                "micro": [
                    {"id": "H1.1", "text": "Lesson objective meaningfully addressed", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "H1.2", "text": "Evidence of learner understanding shown", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "H1.3", "text": "Learner can articulate learning", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
            "H2": {
                "label": "Learner Skill Demonstration", "weight": 0.33,
                "micro": [
                    {"id": "H2.1", "text": "Learner demonstrates target skill or knowledge", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "H2.2", "text": "Improvement observed within session", "score_type": "3pt", "ai": False, "gate": False},
                    {"id": "H2.3", "text": "Errors reduce over time in session", "score_type": "3pt", "ai": False, "gate": False},
                ]
            },
            "H3": {
                "label": "Closure & Consolidation", "weight": 0.33,
                "micro": [
                    {"id": "H3.1", "text": "Key learning points summarized", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "H3.2", "text": "Reinforcement or practice suggested", "score_type": "binary", "ai": True, "gate": False},
                    {"id": "H3.3", "text": "Next steps clearly communicated", "score_type": "binary", "ai": True, "gate": False},
                ]
            },
        }
    },
}

PERFORMANCE_BANDS = [
    (85, "Excellent"),
    (70, "Proficient"),
    (50, "Developing"),
    (0,  "At-Risk"),
]

# =========================================================
# HELPERS
# =========================================================

def log(message):
    print(f"\n--- {message} ---", flush=True)


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def get_file_paths(audio_path):
    base_name    = os.path.basename(audio_path)
    file_no_ext  = os.path.splitext(base_name)[0]

    root_storage          = os.path.join(os.getcwd(), "storage")
    cache_audio_dir       = os.path.join(root_storage, "cache_audio")
    cache_whisper_dir     = os.path.join(root_storage, "cache_whisper")
    cache_diarization_dir = os.path.join(root_storage, "cache_diarization")
    transcript_dir        = os.path.join(root_storage, "transcript")
    rubric_dir            = os.path.join(root_storage, "rubric_scores")   # NEW

    for d in [cache_audio_dir, cache_whisper_dir, cache_diarization_dir,
              transcript_dir, rubric_dir]:
        ensure_dir(d)

    return {
        "base_name":        base_name,
        "file_no_ext":      file_no_ext,
        "cached_wav":       os.path.join(cache_audio_dir,       f"{file_no_ext}.wav"),
        "whisper_json":     os.path.join(cache_whisper_dir,     f"{file_no_ext}.json"),
        "diarization_json": os.path.join(cache_diarization_dir, f"{file_no_ext}.json"),
        "transcript_path":  os.path.join(transcript_dir,
                                base_name.replace("REC_", "TRANS_").replace(".mp3", ".txt")),
        "rubric_json":      os.path.join(rubric_dir,            f"{file_no_ext}_rubric.json"),   # NEW
        "rubric_report":    os.path.join(rubric_dir,            f"{file_no_ext}_report.txt"),    # NEW
    }


def parse_meeting_info(file_no_ext):
    parts = file_no_ext.split("_")
    try:
        meeting_id = parts[1]
    except IndexError:
        log("WARNING: Could not parse meeting_id — using 'Unknown'")
        meeting_id = "Unknown"
    try:
        start_time_str = f"{parts[3]}_{parts[4].replace('-', ':')}"
        start_dt = datetime.strptime(start_time_str, "%Y-%m-%d_%H:%M")
    except (IndexError, ValueError) as exc:
        log(f"WARNING: Could not parse start time ({exc}) — using now()")
        start_dt = datetime.now()
    return meeting_id, start_dt


def _wav_cache_valid(path):
    return os.path.exists(path) and os.path.getsize(path) > MIN_WAV_BYTES


# =========================================================
# STAGE 1 — AUDIO PREPROCESS
# =========================================================

def prepare_audio(audio_path, cached_wav_path):
    if _wav_cache_valid(cached_wav_path):
        log("Using Cached WAV")
        waveform, _ = torchaudio.load(cached_wav_path)
        return cached_wav_path, waveform

    log("Preparing Audio (16kHz mono WAV)")
    waveform, sample_rate = torchaudio.load(audio_path)

    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)

    if sample_rate != 16000:
        resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
        waveform = resampler(waveform)

    torchaudio.save(cached_wav_path, waveform, 16000)
    log(f"Cached WAV Saved: {cached_wav_path}")
    return cached_wav_path, waveform


# =========================================================
# STAGE 2 — WHISPER
# =========================================================

def transcribe_audio(model, wav_path, whisper_json_path):
    if os.path.exists(whisper_json_path):
        log("Using Cached Whisper Transcription")
        with open(whisper_json_path, "r", encoding="utf-8") as f:
            return json.load(f)

    log("Running Whisper Transcription")
    segments_gen, info = model.transcribe(
        wav_path,
        beam_size=WHISPER_BEAM_SIZE,
        vad_filter=True,
        chunk_length=30,
        word_timestamps=False
    )

    segments = [
        {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
        for seg in segments_gen
    ]

    with open(whisper_json_path, "w", encoding="utf-8") as f:
        json.dump(segments, f, indent=2)

    log(f"Whisper Cache Saved: {whisper_json_path}")
    return segments


# =========================================================
# STAGE 3 — DIARIZATION
# =========================================================

def diarize_audio(pipeline, wav_path, diarization_json_path, waveform=None):
    if os.path.exists(diarization_json_path):
        log("Using Cached Diarization")
        with open(diarization_json_path, "r", encoding="utf-8") as f:
            return json.load(f)

    log("Running Speaker Diarization")
    audio_input = {"waveform": waveform, "sample_rate": 16000} if waveform is not None else wav_path
    diarization = pipeline(audio_input)

    speaker_turns = [
        {
            "start":   turn.start,
            "end":     turn.end,
            "speaker": speaker.replace("SPEAKER_", "Participant_")
        }
        for turn, _, speaker in diarization.itertracks(yield_label=True)
    ]

    with open(diarization_json_path, "w", encoding="utf-8") as f:
        json.dump(speaker_turns, f, indent=2)

    log(f"Diarization Cache Saved: {diarization_json_path}")
    return speaker_turns


# =========================================================
# STAGE 4 — MERGE & TRANSCRIPT
# =========================================================

def _build_speaker_index(speaker_turns):
    sorted_turns = sorted(speaker_turns, key=lambda t: t["start"])
    starts = [t["start"] for t in sorted_turns]
    return sorted_turns, starts


def find_speaker(segment_start, segment_end, sorted_turns, starts):
    best_speaker = "Participant_Unknown"
    best_overlap = 0
    idx = bisect_left(starts, segment_end)
    for i in range(idx - 1, -1, -1):
        turn = sorted_turns[i]
        if turn["end"] <= segment_start:
            break
        overlap = max(0, min(segment_end, turn["end"]) - max(segment_start, turn["start"]))
        if overlap > best_overlap:
            best_overlap = overlap
            best_speaker = turn["speaker"]
    return best_speaker


def generate_transcript(transcript_path, meeting_id, start_dt, segments, speaker_turns):
    log("Generating Final Transcript")
    sorted_turns, starts = _build_speaker_index(speaker_turns)

    lines = []
    with open(transcript_path, "w", encoding="utf-8") as f:
        f.write("==========================================\n")
        f.write("MEETING TRANSCRIPT\n")
        f.write("==========================================\n")
        f.write(f"Meeting ID : {meeting_id}\n")
        f.write(f"Date       : {start_dt.strftime('%m/%d/%Y, %I:%M:%S %p')}\n")
        f.write("==========================================\n\n")

        for seg in segments:
            speaker  = find_speaker(seg["start"], seg["end"], sorted_turns, starts)
            seg_time = start_dt + timedelta(seconds=seg["start"])
            line = f"[{seg_time.strftime('%I:%M:%S %p')}] {speaker}: {seg['text']}\n"
            f.write(line)
            lines.append(line)
            print(f"Stored: {line.strip()}", flush=True)

    log(f"Transcript Saved: {transcript_path}")
    return "".join(lines)


# =========================================================
# STAGE 5 — AI RUBRIC SCORING (NEW)
# =========================================================

def _call_claude(transcript_text, indicators):
    """
    Send a batch of AI-scorable micro indicators to Claude API.
    Returns a dict: { indicator_id: score }
    """

    indicator_list = "\n".join(
        f'- ID: {m["id"]} | Criterion: {m["text"]} | Type: {m["score_type"]}'
        for m in indicators
    )

    prompt = f"""You are an expert academic quality reviewer. Below is a teaching session transcript.
Score each criterion strictly based on what is observable in the transcript only.

SCORING RULES:
- binary: score 0 (not observed) or 2 (observed/correct)
- 3pt: score 0 (not observed), 1 (partially), or 2 (fully effective)
- If insufficient evidence, score 0.

CRITERIA TO SCORE:
{indicator_list}

TRANSCRIPT:
{transcript_text[:12000]}

Respond ONLY with a valid JSON object like this (no markdown, no explanation):
{{"A1.1": 2, "A1.2": 1, "B2.1": 0}}
Include every ID listed above."""

    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"Content-Type": "application/json"},
        json={
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": prompt}]
        },
        timeout=60
    )

    response.raise_for_status()
    raw = response.json()["content"][0]["text"].strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    return json.loads(raw.strip())


def score_rubric(transcript_text, rubric_json_path):
    """
    Stage 5: AI pre-scores all AI-scorable micro indicators.
    Human-only indicators default to None (pending human review).
    Aggregates Micro → Meso → Macro → OQI.
    """

    if os.path.exists(rubric_json_path):
        log("Using Cached Rubric Scores")
        with open(rubric_json_path, "r", encoding="utf-8") as f:
            return json.load(f)

    log("Running AI Rubric Scoring (Stage 5)")

    # Collect all AI-scorable indicators in one batch
    ai_indicators = []
    for macro_key, macro in RUBRIC.items():
        for meso_key, meso in macro["meso"].items():
            for micro in meso["micro"]:
                if micro["ai"]:
                    ai_indicators.append(micro)

    log(f"Sending {len(ai_indicators)} AI-scorable indicators to Claude API")
    ai_scores = _call_claude(transcript_text, ai_indicators)

    # Build full results structure
    results = {
        "meeting_summary": {},
        "macro_scores": {},
        "oqi": None,
        "performance_band": None,
        "gate_flags": [],
        "human_pending": [],
        "micro_detail": {}
    }

    macro_weighted_sum = 0.0

    for macro_key, macro in RUBRIC.items():
        meso_weighted_sum = 0.0

        for meso_key, meso in macro["meso"].items():
            micro_scores = []
            max_possible  = 0

            for micro in meso["micro"]:
                mid = micro["id"]
                max_score = 2  # always 2 for both binary and 3pt

                if micro["ai"]:
                    score = ai_scores.get(mid, 0)
                    source = "AI"
                else:
                    score = None
                    source = "Human-Pending"
                    results["human_pending"].append({
                        "id": mid,
                        "text": micro["text"],
                        "score_type": micro["score_type"],
                        "meso": meso["label"],
                        "macro": macro["label"]
                    })

                # Gate check
                if micro["gate"] and score == 0:
                    results["gate_flags"].append({
                        "id": mid,
                        "text": micro["text"],
                        "action": "Score capped / escalation required"
                    })

                results["micro_detail"][mid] = {
                    "text":       micro["text"],
                    "score_type": micro["score_type"],
                    "score":      score,
                    "max":        max_score,
                    "source":     source,
                    "gate":       micro["gate"]
                }

                if score is not None:
                    micro_scores.append((score, max_score))
                    max_possible += max_score

            # Meso score = sum of micro % × equal weight per micro
            if micro_scores:
                meso_pct = sum(s / m * 100 for s, m in micro_scores) / len(micro_scores)
            else:
                meso_pct = 0.0

            meso_weighted_sum += meso_pct * meso["weight"]

            results["micro_detail"][meso_key] = {
                "_meso_label": meso["label"],
                "_meso_score_pct": round(meso_pct, 2)
            }

        results["macro_scores"][macro_key] = {
            "label": macro["label"],
            "score_pct": round(meso_weighted_sum, 2),
            "weight": macro["weight"]
        }
        macro_weighted_sum += meso_weighted_sum * macro["weight"]

    # OQI
    oqi = round(macro_weighted_sum, 2)
    results["oqi"] = oqi

    band = "At-Risk"
    for threshold, label in PERFORMANCE_BANDS:
        if oqi >= threshold:
            band = label
            break
    results["performance_band"] = band

    # Gate cap
    if results["gate_flags"]:
        results["oqi_capped"] = True
        results["oqi_display"] = min(oqi, 49.0)
        results["oqi_note"] = f"{len(results['gate_flags'])} fatal indicator(s) triggered — score capped"
    else:
        results["oqi_capped"] = False
        results["oqi_display"] = oqi

    with open(rubric_json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    log(f"Rubric JSON Saved: {rubric_json_path}")
    return results


def generate_rubric_report(results, report_path, meeting_id, start_dt):
    """Generate a human-readable rubric report."""

    log("Generating Rubric Report")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("==========================================\n")
        f.write("AI RUBRIC SCORING REPORT\n")
        f.write("==========================================\n")
        f.write(f"Meeting ID        : {meeting_id}\n")
        f.write(f"Date              : {start_dt.strftime('%m/%d/%Y, %I:%M:%S %p')}\n")
        f.write(f"OQI Score         : {results['oqi_display']} / 100\n")
        f.write(f"Performance Band  : {results['performance_band']}\n")
        if results.get("oqi_capped"):
            f.write(f"NOTE              : {results['oqi_note']}\n")
        f.write("==========================================\n\n")

        f.write("MACRO DOMAIN SCORES\n")
        f.write("------------------------------------------\n")
        for key, macro in results["macro_scores"].items():
            bar_len = int(macro["score_pct"] / 5)
            bar = "#" * bar_len + "-" * (20 - bar_len)
            f.write(f"{key}. {macro['label']:<40} {macro['score_pct']:>6.1f}%  [{bar}]\n")

        if results["gate_flags"]:
            f.write("\n==========================================\n")
            f.write("FATAL INDICATORS TRIGGERED\n")
            f.write("==========================================\n")
            for flag in results["gate_flags"]:
                f.write(f"  [{flag['id']}] {flag['text']}\n")
                f.write(f"         Action: {flag['action']}\n")

        f.write("\n==========================================\n")
        f.write("PENDING HUMAN REVIEW\n")
        f.write("==========================================\n")
        f.write(f"Total indicators requiring human review: {len(results['human_pending'])}\n\n")
        for item in results["human_pending"]:
            f.write(f"  [{item['id']}] {item['text']}  ({item['score_type']})\n")
            f.write(f"         Domain: {item['macro']} > {item['meso']}\n")

        f.write("\n==========================================\n")
        f.write("FULL MICRO INDICATOR DETAIL\n")
        f.write("==========================================\n")
        for mid, detail in results["micro_detail"].items():
            if "_meso_label" in detail:
                f.write(f"\n  [{mid}] {detail['_meso_label']}  — meso avg: {detail['_meso_score_pct']}%\n")
            else:
                score_str = str(detail["score"]) if detail["score"] is not None else "Pending"
                gate_str  = " [GATE]" if detail["gate"] else ""
                f.write(f"    {mid}: {detail['text']}\n")
                f.write(f"         Score: {score_str}/{detail['max']}  Source: {detail['source']}{gate_str}\n")

    log(f"Rubric Report Saved: {report_path}")


# =========================================================
# MAIN
# =========================================================

try:

    HF_TOKEN = os.getenv("HF_TOKEN")
    if not HF_TOKEN:
        raise Exception("HF_TOKEN environment variable missing")

    if len(sys.argv) < 2:
        raise Exception("Audio path missing")

    audio_path = sys.argv[1]
    if not os.path.exists(audio_path):
        raise Exception(f"Audio file not found: {audio_path}")

    paths = get_file_paths(audio_path)
    meeting_id, start_dt = parse_meeting_info(paths["file_no_ext"])

    # =====================================================
    # DEVICE
    # =====================================================
    device = "cuda" if torch.cuda.is_available() else "cpu"
    log(f"Using Device: {device}")

    # =====================================================
    # STAGE 1
    # =====================================================
    cached_wav, waveform_tensor = prepare_audio(audio_path, paths["cached_wav"])

    # =====================================================
    # STAGE 2 — Whisper
    # =====================================================
    log("Loading Whisper Model")
    whisper_model = WhisperModel(
        WHISPER_MODEL_SIZE,
        device=device,
        compute_type="float32",
        cpu_threads=CPU_THREADS,
        num_workers=2
    )

    segments = transcribe_audio(whisper_model, cached_wav, paths["whisper_json"])

    del whisper_model
    if device == "cuda":
        torch.cuda.empty_cache()

    # =====================================================
    # STAGE 3 — Diarization
    # =====================================================
    log("Loading Pyannote Pipeline")
    diarization_pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        token=HF_TOKEN
    )
    diarization_pipeline.to(torch.device(device))

    speaker_turns = diarize_audio(
        diarization_pipeline,
        cached_wav,
        paths["diarization_json"],
        waveform=waveform_tensor
    )

    # =====================================================
    # STAGE 4 — Transcript
    # =====================================================
    transcript_text = generate_transcript(
        paths["transcript_path"],
        meeting_id,
        start_dt,
        segments,
        speaker_turns
    )

    # =====================================================
    # STAGE 5 — AI Rubric Scoring
    # =====================================================
    rubric_results = score_rubric(transcript_text, paths["rubric_json"])

    generate_rubric_report(
        rubric_results,
        paths["rubric_report"],
        meeting_id,
        start_dt
    )

    # Print summary to console
    print("\n==========================================")
    print(f"  OQI SCORE : {rubric_results['oqi_display']} / 100")
    print(f"  BAND      : {rubric_results['performance_band']}")
    if rubric_results.get("oqi_capped"):
        print(f"  NOTE      : {rubric_results['oqi_note']}")
    print(f"  GATES     : {len(rubric_results['gate_flags'])} triggered")
    print(f"  PENDING   : {len(rubric_results['human_pending'])} indicators need human review")
    print("==========================================")

    log("PROCESS COMPLETE")

except Exception as e:
    print(f"\nPYTHON_CRASH_ERROR: {str(e)}\n")
    traceback.print_exc()
    sys.exit(1)