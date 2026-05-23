# services/engine/media_service/__init__.py
import os
from .file_validator import FileValidator
from .path_formatter import PathFormatter
from .ffmpeg_converter import FfmpegConverter

class MediaService:
    def __init__(self, root_dir):
        self.root_dir = root_dir
        self.recordings_dir = os.path.join(root_dir, "storage", "recordings")
        
        # Initialize sub-components
        self.validator = FileValidator(self.recordings_dir)
        self.converter = FfmpegConverter(self.recordings_dir)

    def get_audio_path(self, file_name):
        """Verifies the file exists and returns its full path."""
        return self.validator.verify_path(file_name)

    def extract_audio(self, input_path):
        """Orchestrates path formatting and FFmpeg processing."""
        print("\n" + "-"*65, flush=True)
        print("[MEDIA SERVICE] Activating Media Container Extraction Pipeline...", flush=True)
        print("-"*65 + "\n", flush=True)

        # Step 1: Format target output file name strings
        formatted_name = PathFormatter.format_output_name(input_path)

        # Step 2: Handle calculation or read from cache
        output_path = self.converter.execute_conversion(input_path, formatted_name)

        print("[MEDIA SERVICE] Asset ready for downstream processes.\n", flush=True)
        return output_path