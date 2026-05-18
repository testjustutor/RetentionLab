# services/engine/media_service/file_validator.py
import os
import time

class FileValidator:
    def __init__(self, recordings_dir):
        self.recordings_dir = recordings_dir

    def verify_path(self, file_name):
        audio_path = os.path.join(self.recordings_dir, file_name)
        print(f"[MEDIA - VALIDATOR] Checking recording footprint: {audio_path}", flush=True)

        # Simulated operational heartbeat
        for i in range(1, 4):
            print(f"[MEDIA - VALIDATOR] Status: Locating hardware asset streams... {i}/3", flush=True)
            time.sleep(0.2)

        if not os.path.exists(audio_path):
            print(f"[MEDIA - VALIDATOR] CRITICAL ERROR: File missing: {file_name}", flush=True)
            raise FileNotFoundError(f"Recording file not found at: {audio_path}")

        print("[MEDIA - VALIDATOR] Success: File verified on local server block.", flush=True)
        return audio_path