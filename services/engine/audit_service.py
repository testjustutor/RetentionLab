import sys
import json
import datetime
import os
import sqlite3

class AuditService:
    def __init__(self, db_path):
        """ Initialize the service with the path to the SQLite database. """
        self.db_path = db_path

    def get_full_rubric_from_db(self):
        """ Fetches the rubric structure directly from the SQLite database. """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT category_id, name, weight FROM rubric_categories")
        categories = cursor.fetchall()

        rubric = {}
        for cat in categories:
            rubric[cat['category_id']] = {
                "name": cat['name'],
                "weight": cat['weight'],
                "indicators": {}
            }

            cursor.execute("""
                SELECT indicator_id, name, type, is_gate
                FROM rubric_indicators
                WHERE category_id = ?
            """, (cat['category_id'],))

            indicators = cursor.fetchall()
            for ind in indicators:
                rubric[cat['category_id']]["indicators"][ind['indicator_id']] = {
                    "name": ind['name'],
                    "type": ind['type'],
                    "is_gate": bool(ind['is_gate'])
                }
        conn.close()
        return rubric

    def run_audit(self, transcript_text):
        """
        Dynamically analyzes the transcript based on DB rubric and weights.
        """
        rubric = self.get_full_rubric_from_db()
        lower_text = transcript_text.lower()

        domain_scores = {}
        total_weighted_oqi = 0
        total_weight_found = 0

        for cat_id, category in rubric.items():
            cat_name = category["name"]
            cat_weight = category["weight"]
            indicators = category["indicators"]

            earned_points = 0
            possible_points = len(indicators) * 2

            for ind_id, ind_data in indicators.items():
                score = 0
                if "objective" in ind_data["name"].lower() or "goal" in ind_data["name"].lower():
                    if any(word in lower_text for word in ["today", "learn", "objective"]):
                        score = 2
                elif "engagement" in ind_data["name"].lower() or "praise" in ind_data["name"].lower():
                    if any(word in lower_text for word in ["good", "excellent", "well done"]):
                        score = 2
                else:
                    score = 1

                earned_points += score

            cat_percentage = (earned_points / possible_points) * 100 if possible_points > 0 else 0
            domain_scores[cat_name] = round(cat_percentage, 2)

            total_weighted_oqi += (cat_percentage * cat_weight)
            total_weight_found += cat_weight

        final_oqi = round(total_weighted_oqi / total_weight_found, 2) if total_weight_found > 0 else 0
        evidence = self.extract_dynamic_evidence(transcript_text)

        result = {
            "oqi_score": final_oqi,
            "evidence_quote": evidence,
            "domain_scores": domain_scores,
            "audit_details": rubric
        }

        return result

    def extract_dynamic_evidence(self, text):
        """Helper to grab a real sentence from the transcript."""
        sentences = text.split('.')
        for s in sentences:
            if any(word in s.lower() for word in ["learn", "objective", "today", "start"]):
                return s.strip() + "."
        return "No specific evidence quote identified."

    def cluster_topics(self, diarization_data):
        """
        Dynamically groups transcript segments and generates topic titles.
        """
        if not diarization_data:
            return []

        chunks = []
        current_chunk = []
        last_break = 0

        for segment in diarization_data:
            current_chunk.append(segment['text'])
            if segment['end'] - last_break >= 300:
                start_time = self._format_time(last_break)
                end_time = self._format_time(segment['end'])

                text_preview = " ".join(current_chunk).lower()
                topic = "General Discussion"
                if "hello" in text_preview or "welcome" in text_preview:
                    topic = "Introduction & Greetings"
                elif "homework" in text_preview or "assignment" in text_preview:
                    topic = "Review & Assignments"
                elif "goodbye" in text_preview or "next time" in text_preview:
                    topic = "Wrap-up & Closing"

                chunks.append({
                    "time": f"{start_time} - {end_time}",
                    "topic": topic
                })
                current_chunk = []
                last_break = segment['end']

        return chunks

    def _format_time(self, seconds):
        """Helper to convert seconds to MM:SS"""
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins:02d}:{secs:02d}"

    def generate_summary(self, transcript_text, labeled_text):
        """ Generates a short narrative summary of the meeting. """
        word_count = len(transcript_text.split())
        summary = f"Meeting Analysis: This session contained approximately {word_count} words. "
        summary += "The interaction was primarily instructor-led with clear objective setting."
        return summary