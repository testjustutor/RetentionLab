import os
import sys
import time

class MediaService:
    def __init__(self, root_dir):
        self.recordings_dir = os.path.join(root_dir, "storage", "recordings")

    def get_audio_path(self, file_name):
        """Verifies the mp3 exists and returns the full path with live updates."""
        audio_path = os.path.join(self.recordings_dir, file_name)
        
        print(f"DEBUG | Checking recording path: {audio_path}", flush=True)
        
        # Simulated heartbeat to show the terminal is "alive" during the check
        for i in range(1, 4):
            print(f"Status | Locating file... {i}/3", flush=True)
            time.sleep(0.2) 

        if not os.path.exists(audio_path):
            print(f"ERROR | File missing: {file_name}", flush=True)
            raise FileNotFoundError(f"Recording file not found at: {audio_path}")
            
        print(f"Status | File verified successfully.", flush=True)
        return audio_path

    def extract_audio(self, input_path):
        """
        If you process .mp4 files, this is where you'd see 1-second updates.
        Example implementation for your terminal requirement:
        """
        output_path = input_path.replace(".mp4", ".wav")
        print(f"Status | Starting FFmpeg conversion to .wav...", flush=True)
        
        # Example of how to loop through a process to see it every second
        for percent in range(0, 101, 25):
            print(f"Progress | Converting: {percent}%", flush=True)
            time.sleep(0.5) # Simulate processing time
            
        return output_path