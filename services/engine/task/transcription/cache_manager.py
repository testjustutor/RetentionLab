import os
import json


class TranscriptionCacheManager:

    @staticmethod
    def save_whisper_output(context, raw_result):

        output_path = os.path.join(
            context.storage_paths["cache_whisper"],
            f"WHISPER_{context.base_id}.json"
        )

        with open(output_path, "w", encoding="utf-8") as file:
            json.dump(raw_result, file, indent=4)

        return output_path

    @staticmethod
    def save_diarization_output(context, diarization_data):

        output_path = os.path.join(
            context.storage_paths["cache_diarization"],
            f"DIAR_{context.base_id}.json"
        )

        with open(output_path, "w", encoding="utf-8") as file:
            json.dump(diarization_data, file, indent=4)

        return output_path

    @staticmethod
    def save_voice_activity(context, processed_script):

        vad_output = []

        for segment in processed_script:

            vad_output.append({
                "start": segment.get("start"),
                "end": segment.get("end"),
                "speaker": segment.get("speaker")
            })

        output_path = os.path.join(
            context.storage_paths["cache_voice_activity"],
            f"VAD_{context.base_id}.json"
        )

        with open(output_path, "w", encoding="utf-8") as file:
            json.dump(vad_output, file, indent=4)

        return output_path

    @staticmethod
    def save_raw_captions(context, processed_script):

        captions = []

        for segment in processed_script:

            captions.append({
                "speaker": segment.get("speaker"),
                "text": segment.get("text")
            })

        output_path = os.path.join(
            context.storage_paths["cache_captions_raw"],
            f"CAPTIONS_{context.base_id}.json"
        )

        with open(output_path, "w", encoding="utf-8") as file:
            json.dump(captions, file, indent=4)

        return output_path