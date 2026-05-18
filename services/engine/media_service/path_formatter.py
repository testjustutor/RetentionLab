# services/engine/media_service/path_formatter.py
import os

class PathFormatter:
    @staticmethod
    def format_output_name(input_path):
        print("[MEDIA - FORMATTER] Parsing structural name identifiers...", flush=True)
        
        if not input_path.lower().endswith(".mp3"):
            raise ValueError("MediaService processing supports only .mp3 source structures.")

        base_name = os.path.splitext(os.path.basename(input_path))[0]
        
        # Transformation logic: Strip 'REC_' and prepend 'WAV_'
        if base_name.startswith("REC_"):
            formatted_name = "WAV_" + base_name[4:]
        else:
            formatted_name = "WAV_" + base_name
            
        print(f"[MEDIA - FORMATTER] String updated: mapping blueprint to -> {formatted_name}.wav", flush=True)
        return formatted_name