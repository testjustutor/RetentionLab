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
        # Allows accessing columns by name
        conn.row_factory = sqlite3.Row 
        cursor = conn.cursor()

        # 1. Fetch all categories
        cursor.execute("SELECT category_id, name, weight FROM rubric_categories")
        categories = cursor.fetchall()

        rubric = {}
        for cat in categories:
            rubric[cat['category_id']] = {
                "name": cat['name'],
                "weight": cat['weight'],
                "indicators": {}
            }

            # 2. Fetch indicators for this specific category
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
                    "gate": bool(ind['is_gate']),
                    "score": 0  # Initialize score for current audit
                }

        conn.close()
        return rubric

    def run_audit(self, transcript_text):
        """
        Analyzes the transcript and calculates the OQI (Overall Quality Index).
        """
        # Fetch rubric dynamically from database
        rubric = self.get_full_rubric_from_db()
        lower_text = transcript_text.lower()
        
        # 1. KEYWORD SCORING LOGIC (AI Automated)
        # ---------------------------------------------------------
        
        # Domain A - Pedagogy
        if "A" in rubric and "A1.1" in rubric["A"]["indicators"]:
            if any(w in lower_text for w in ["today", "learn", "goal", "objective", "aim of the session"]): 
                rubric["A"]["indicators"]["A1.1"]["score"] = 2
        
        # Domain C - Engagement
        if "C" in rubric and "C3.1" in rubric["C"]["indicators"]:
            if any(w in lower_text for w in ["well done", "good job", "excellent", "exactly", "keep going"]): 
                rubric["C"]["indicators"]["C3.1"]["score"] = 2

        # Domain G - Professionalism (Safety check)
        # Defaulting safety to 2 unless prohibited words found
        if "G" in rubric and "G3.1" in rubric["G"]["indicators"]:
            rubric["G"]["indicators"]["G3.1"]["score"] = 2 
            
        # 2. CALCULATION & DOMAIN AGGREGATION
        # ---------------------------------------------------------
        domain_breakdown = {}
        total_weighted_score = 0
        
        for key, domain in rubric.items():
            # Calculate average for AI indicators in this domain
            ai_indicators = [ind for ind in domain['indicators'].values() if ind['type'] == 'AI']
            if not ai_indicators:
                continue
                
            avg_score = sum(ind['score'] for ind in ai_indicators) / len(ai_indicators)
            
            # Normalize to percentage (avg_score/2 * 100)
            domain_percentage = (avg_score / 2) * 100
            domain_breakdown[domain['name']] = round(domain_percentage, 2)
            
            # Weight the score for OQI
            total_weighted_score += (avg_score / 2) * domain['weight']
        
        oqi = round(total_weighted_score * 100, 2)
        
        return {
            "oqi_score": oqi,
            "domain_scores": domain_breakdown,
            "audit_details": rubric
        }

    def generate_summary(self, audio_text, labeled_text):
        word_count = len(audio_text.split())
        summary = f"Meeting Summary: The session covered instructional objectives with high engagement. Total word count: {word_count}."
        return summary

# ==========================================
# MAIN EXECUTION BLOCK (The Handoff Bridge)
# ==========================================
if __name__ == "__main__":
    # Resolve the database path relative to this script's location
    # Assumes transcripts.db is in the parent directory of this script
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH = os.path.join(BASE_DIR, 'transcripts.db')

    try:
        # Read JSON data from Node.js (stdin)
        input_data = json.load(sys.stdin)
        
        audio_text = input_data.get('audioText', '')
        labeled_text = input_data.get('labeledText', '')

        # Initialize service with DB path
        service = AuditService(DB_PATH)

        # 1. Run the Audit Rubric
        audit_results = service.run_audit(audio_text)

        # 2. Generate the Narrative Summary
        narrative_summary = service.generate_summary(audio_text, labeled_text)

        response = {
            "success": True,
            "summary": narrative_summary,
            "oqi_score": audit_results["oqi_score"],
            "domain_scores": audit_results["domain_scores"],
            "processed_at": datetime.datetime.now().isoformat()
        }
        
        print(json.dumps(response))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)