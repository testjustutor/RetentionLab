class TranscriptionService:
    def __init__(self, hf_token=None):
        # Lazy import to prevent entire engine from crashing at import-time
        # when optional native deps for `whisper` fail (common after upgrades).
        from .model_manager import ModelManager

        self.model_manager = ModelManager()
        self.hf_token = hf_token


    def process(self, audio_path):
        from .analytics_engine import AnalyticsEngine
        from .filter_worker import FilterWorker
        from .formatter import Formatter
        from .token_processor import TokenProcessor

        print("\n" + "-"*65, flush=True)
        print("[TRANSCRIPTION SERVICE] Activating Layered Audio Processing Pipeline...", flush=True)
        print("-"*65 + "\n", flush=True)

        # STEP 1: Decode Audio using AI model
        raw_result = self.model_manager.decode_audio(audio_path)

        # STEP 2: Normalize and format raw segments
        processed_script = TokenProcessor.normalize_segments(raw_result, audio_path, self.hf_token)

        # 🚀 THE PLUG-IN FIX: Run the text filter step right here!
        processed_script = FilterWorker.clean_text(processed_script)

        # STEP 3 & 4: Run volume analytics and role mapping
        talk_ratio, instructor_id = AnalyticsEngine.calculate_talk_metrics(processed_script)

        # STEP 5: Format the final transcript payload string
        labeled_transcript = Formatter.build_labeled_string(processed_script, instructor_id)

        # Re-create a standard list of segment tuples/dicts to safely satisfy Step 5 TopicService downstream
        diarization_data_compat = [
            {"start": s["start"], "end": s["end"], "speaker": s["speaker"]} 
            for s in processed_script
        ]

        print("[TRANSCRIPTION - SERVICE] Execution Complete. Returning compiled matrices.\n", flush=True)
        return labeled_transcript, talk_ratio, diarization_data_compat
