# root/services/engine/manual/__init__.py
"""
Manual / on-demand pipeline scripts.
Diarization is intentionally NOT part of the automatic
media -> transcription -> [audit, summary] -> persist_results graph.

Run speaker diarization on demand for an already-transcribed meeting:

    python services/engine/manual/run_diarization.py --meeting_id=2 \
        --session_id=159 --audio_path=storage/audio/REC_xxx.wav
"""