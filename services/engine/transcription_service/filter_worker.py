# services/engine/transcription_service/filter_worker.py

class FilterWorker:
    @staticmethod
    def clean_text(processed_script):
        print("[TRANSCRIPTION - EXTENSION] Running custom word filter step...", flush=True)
        for seg in processed_script:
            seg["text"] = seg["text"].replace("badword", "***")
        return processed_script