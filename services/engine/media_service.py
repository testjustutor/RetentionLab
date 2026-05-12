import os
import moviepy.editor as mp

class MediaService:
    def __init__(self, root_dir):
        self.audio_cache = os.path.join(root_dir, "storage", "cache_audio")
        os.makedirs(self.audio_cache, exist_ok=True)

    def extract_audio(self, video_path):
        # --- CODE FROM COLAB CELL 4 START ---
        audio_output = os.path.join(self.audio_cache, os.path.basename(video_path).replace(".mp4", ".wav"))
        
        if os.path.exists(audio_output):
            return audio_output
            
        try:
            clip = mp.VideoFileClip(video_path)
            clip.audio.write_audiofile(audio_output, codec='pcm_s16le', logger=None)
            clip.close()
            return audio_output
        except Exception as e:
            raise Exception(f"Extraction failed: {e}")
        # --- CODE FROM COLAB CELL 4 END ---