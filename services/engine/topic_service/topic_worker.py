# services/engine/topic_service/topic_worker.py
import sys
import time

class TopicService:
    def __init__(self):
        pass

    def _to_timestamp(self, total_seconds):
        mins = int(total_seconds // 60)
        secs = int(total_seconds % 60)
        return f"{mins:02d}:{secs:02d}"

    def compute_clusters(self, timeline_segments):
        print("[TOPIC MICROSERVICE] Status: Reading chronological diarization timeline arrays...", flush=True)
        if not timeline_segments:
            print("[TOPIC MICROSERVICE] Warning: Data chunk maps empty. Breaking service loop.", flush=True)
            return []

        total_frames = len(timeline_segments)
        clusters = []
        running_text = []
        window_start = timeline_segments[0]['start']

        print(f"[TOPIC MICROSERVICE] Status: Sorting {total_frames} timeline frames into structured intervals...", flush=True)
        
        for idx, frame in enumerate(timeline_segments):
            running_text.append(frame['text'])
            
            # Live incremental percentage math calculated out dynamically via array tracking loops
            if idx % max(1, total_frames // 4) == 0:
                current_percent = int((idx / total_frames) * 100)
                print(f"[TOPIC MICROSERVICE] Progress: Keyword array clustering {current_percent}% computed...", flush=True)
                time.sleep(0.1)
            
            if frame['end'] - window_start >= 300: # 5 Minute Splits
                combined_text = " ".join(running_text).lower()
                assigned_topic = "General Discussion"
                
                if any(w in combined_text for w in ["hello", "welcome", "good morning", "greetings"]):
                    assigned_topic = "Introduction & Greetings"
                elif any(w in combined_text for w in ["homework", "assignment", "project", "tasks"]):
                    assigned_topic = "Review & Assignments"
                elif any(w in combined_text for w in ["goodbye", "see you", "leave", "wrap up"]):
                    assigned_topic = "Wrap-up & Closing"

                clusters.append({
                    "time_frame": f"{self._to_timestamp(window_start)} - {self._to_timestamp(frame['end'])}",
                    "topic": assigned_topic
                })
                running_text = []
                window_start = frame['end']

        if running_text:
            clusters.append({
                "time_frame": f"{self._to_timestamp(window_start)} - {self._to_timestamp(timeline_segments[-1]['end'])}",
                "topic": "General Discussion"
            })

        print("[TOPIC MICROSERVICE] Progress: Timeline chronological chunk processing 100% complete!", flush=True)
        return clusters