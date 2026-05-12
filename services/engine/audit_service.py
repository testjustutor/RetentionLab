import datetime

class AuditService:
    def get_full_rubric(self):
        return {
            "A": {"name": "Instructional Quality & Pedagogy", "weight": 0.22, "indicators": {
                "A1.1": {"name": "Opening states purpose/objective", "type": "AI", "score": 0, "gate": False},
                "A1.2": {"name": "Instruction follows logical sequence", "type": "AI", "score": 0, "gate": False},
                "A1.3": {"name": "Practice activities align to instruction", "type": "AI", "score": 0, "gate": False},
                "A1.4": {"name": "Session includes meaningful closure", "type": "AI", "score": 0, "gate": False},
                "A2.1": {"name": "Uses evidence-based strategy", "type": "AI", "score": 0, "gate": False},
                "A2.2": {"name": "Modeling precedes guided practice", "type": "AI", "score": 0, "gate": False},
                "A2.3": {"name": "Strategy matches learning objective", "type": "HUMAN", "score": 0, "gate": False},
                "A2.4": {"name": "Adjusts strategy based on learner response", "type": "HUMAN", "score": 0, "gate": False},
                "A3.1": {"name": "Explanations accurate and clear", "type": "AI", "score": 0, "gate": True},
                "A3.2": {"name": "Examples are age/level appropriate", "type": "AI", "score": 0, "gate": False},
                "A3.3": {"name": "Uses think-alouds/worked examples", "type": "AI", "score": 0, "gate": False},
                "A3.4": {"name": "Avoids cognitive overload", "type": "HUMAN", "score": 0, "gate": False},
                "A4.1": {"name": "Instruction adjusted to learner level", "type": "HUMAN", "score": 0, "gate": False},
                "A4.2": {"name": "Uses prompts or cues to support", "type": "AI", "score": 0, "gate": False},
                "A4.3": {"name": "Gradual release of responsibility observed", "type": "AI", "score": 0, "gate": False},
                "A4.4": {"name": "Support provided when learner struggles", "type": "HUMAN", "score": 0, "gate": False}
            }},
            "B": {"name": "Curriculum Alignment & Accuracy", "weight": 0.15, "indicators": {
                "B1.1": {"name": "Objective aligns to curriculum", "type": "AI", "score": 0, "gate": False},
                "B1.2": {"name": "Content matches scope & sequence", "type": "AI", "score": 0, "gate": False},
                "B1.3": {"name": "No off-grade/irrelevant content", "type": "AI", "score": 0, "gate": False},
                "B2.1": {"name": "No factual/conceptual errors", "type": "AI", "score": 0, "gate": True},
                "B2.2": {"name": "Terminology used correctly", "type": "AI", "score": 0, "gate": True},
                "B2.3": {"name": "Corrects own mistakes", "type": "HUMAN", "score": 0, "gate": True},
                "B3.1": {"name": "Adequate depth for learner level", "type": "HUMAN", "score": 0, "gate": False},
                "B3.2": {"name": "Avoids unnecessary digressions", "type": "AI", "score": 0, "gate": False},
                "B3.3": {"name": "Maintains focus on objective", "type": "AI", "score": 0, "gate": False},
                "B4.1": {"name": "Tasks support objective", "type": "AI", "score": 0, "gate": False},
                "B4.2": {"name": "Materials are grade-appropriate", "type": "AI", "score": 0, "gate": False},
                "B4.3": {"name": "Resources used effectively", "type": "HUMAN", "score": 0, "gate": False}
            }},
            "C": {"name": "Learner Engagement & Responsiveness", "weight": 0.14, "indicators": {
                "C1.1": {"name": "Learner required to think/respond", "type": "AI", "score": 0, "gate": False},
                "C1.2": {"name": "Questions promote reasoning", "type": "HUMAN", "score": 0, "gate": False},
                "C1.3": {"name": "Opportunities for application provided", "type": "AI", "score": 0, "gate": False},
                "C2.1": {"name": "Learner remains on-task", "type": "AI", "score": 0, "gate": False},
                "C2.2": {"name": "Instructor monitors engagement", "type": "AI", "score": 0, "gate": False},
                "C2.3": {"name": "Off-task behavior addressed", "type": "HUMAN", "score": 0, "gate": False},
                "C3.1": {"name": "Positive reinforcement used", "type": "AI", "score": 0, "gate": False},
                "C3.2": {"name": "Instructor tone is encouraging", "type": "AI", "score": 0, "gate": False},
                "C3.3": {"name": "Responds to learner frustration", "type": "HUMAN", "score": 0, "gate": False},
                "C4.1": {"name": "Acknowledges learner responses", "type": "AI", "score": 0, "gate": False},
                "C4.2": {"name": "Adjusts instruction based on input", "type": "HUMAN", "score": 0, "gate": False},
                "C4.3": {"name": "Follows up on incorrect responses", "type": "AI", "score": 0, "gate": False}
            }},
            "D": {"name": "Assessment & Feedback Quality", "weight": 0.12, "indicators": {
                "D1.1": {"name": "Checks for understanding embedded", "type": "AI", "score": 0, "gate": False},
                "D1.2": {"name": "Questions/tasks used diagnostically", "type": "HUMAN", "score": 0, "gate": False},
                "D1.3": {"name": "Assessment aligned to objective", "type": "AI", "score": 0, "gate": False},
                "D2.1": {"name": "Feedback is timely", "type": "AI", "score": 0, "gate": False},
                "D2.2": {"name": "Feedback is specific/actionable", "type": "HUMAN", "score": 0, "gate": False},
                "D2.3": {"name": "Feedback focuses on process", "type": "AI", "score": 0, "gate": False},
                "D3.1": {"name": "Errors identified correctly", "type": "AI", "score": 0, "gate": False},
                "D3.2": {"name": "Misconceptions explicitly addressed", "type": "HUMAN", "score": 0, "gate": False},
                "D3.3": {"name": "Corrective feedback is respectful", "type": "AI", "score": 0, "gate": False},
                "D4.1": {"name": "Tracks performance during session", "type": "AI", "score": 0, "gate": False},
                "D4.2": {"name": "Adjusts pacing based on progress", "type": "HUMAN", "score": 0, "gate": False},
                "D4.3": {"name": "Uses evidence for next steps", "type": "HUMAN", "score": 0, "gate": False}
            }},
            "E": {"name": "Classroom Management & Pacing", "weight": 0.10, "indicators": {
                "E1.1": {"name": "Pacing appropriate for learner", "type": "HUMAN", "score": 0, "gate": False},
                "E1.2": {"name": "Time allocated proportionally", "type": "AI", "score": 0, "gate": False},
                "E1.3": {"name": "No prolonged idle time", "type": "AI", "score": 0, "gate": False},
                "E2.1": {"name": "Instructor maintains control", "type": "AI", "score": 0, "gate": False},
                "E2.2": {"name": "Clear directions provided", "type": "AI", "score": 0, "gate": False},
                "E2.3": {"name": "Manages disruptions effectively", "type": "HUMAN", "score": 0, "gate": False},
                "E3.1": {"name": "Smooth transitions", "type": "AI", "score": 0, "gate": False},
                "E3.2": {"name": "Maintains instructional momentum", "type": "HUMAN", "score": 0, "gate": False},
                "E3.3": {"name": "Minimizes downtime", "type": "AI", "score": 0, "gate": False},
                "E4.1": {"name": "Instructional time maximized", "type": "AI", "score": 0, "gate": False},
                "E4.2": {"name": "Minimal off-task talk", "type": "AI", "score": 0, "gate": False},
                "E4.3": {"name": "Administrative tasks minimized", "type": "AI", "score": 0, "gate": False}
            }},
            "F": {"name": "Communication & Language Use", "weight": 0.10, "indicators": {
                "F1.1": {"name": "Speech is clear/audible", "type": "AI", "score": 0, "gate": False},
                "F1.2": {"name": "Instructions are concise", "type": "AI", "score": 0, "gate": False},
                "F1.3": {"name": "Rephrases when confused", "type": "HUMAN", "score": 0, "gate": False},
                "F2.1": {"name": "Vocabulary appropriate for level", "type": "AI", "score": 0, "gate": False},
                "F2.2": {"name": "Avoids unnecessary jargon", "type": "AI", "score": 0, "gate": False},
                "F2.3": {"name": "Adjusts language for learner", "type": "HUMAN", "score": 0, "gate": False},
                "F3.1": {"name": "Uses open-ended questions", "type": "AI", "score": 0, "gate": False},
                "F3.2": {"name": "Provides adequate wait time", "type": "HUMAN", "score": 0, "gate": False},
                "F3.3": {"name": "Probes learner thinking", "type": "HUMAN", "score": 0, "gate": False},
                "F4.1": {"name": "Listens without interruption", "type": "AI", "score": 0, "gate": False},
                "F4.2": {"name": "Allows sufficient learner talk time", "type": "HUMAN", "score": 0, "gate": False},
                "F4.3": {"name": "Responds appropriately to cues", "type": "HUMAN", "score": 0, "gate": False}
            }},
            "G": {"name": "Professionalism & Compliance", "weight": 0.09, "indicators": {
                "G1.1": {"name": "Maintains respectful tone", "type": "AI", "score": 0, "gate": True},
                "G1.2": {"name": "Demonstrates patience", "type": "AI", "score": 0, "gate": False},
                "G1.3": {"name": "Maintains appropriate body language", "type": "HUMAN", "score": 0, "gate": False},
                "G2.1": {"name": "Uses platform tools correctly", "type": "AI", "score": 0, "gate": False},
                "G2.2": {"name": "Follows session protocols", "type": "AI", "score": 0, "gate": True},
                "G2.3": {"name": "No prohibited actions observed", "type": "AI", "score": 0, "gate": True},
                "G3.1": {"name": "Learner safety maintained", "type": "AI", "score": 0, "gate": True},
                "G3.2": {"name": "No inappropriate content", "type": "AI", "score": 0, "gate": True},
                "G3.3": {"name": "Handles sensitive situations", "type": "HUMAN", "score": 0, "gate": True}
            }},
            "H": {"name": "Learning Outcomes & Evidence", "weight": 0.08, "indicators": {
                "H1.1": {"name": "Objective meaningfully addressed", "type": "AI", "score": 0, "gate": False},
                "H1.2": {"name": "Evidence of learner understanding", "type": "HUMAN", "score": 0, "gate": False},
                "H1.3": {"name": "Learner can articulate learning", "type": "AI", "score": 0, "gate": False},
                "H2.1": {"name": "Learner demonstrates target skill", "type": "AI", "score": 0, "gate": False},
                "H2.2": {"name": "Improvement within session", "type": "HUMAN", "score": 0, "gate": False},
                "H2.3": {"name": "Errors reduce over time", "type": "HUMAN", "score": 0, "gate": False},
                "H3.1": {"name": "Key learning summarized", "type": "AI", "score": 0, "gate": False},
                "H3.2": {"name": "Reinforcement/practice suggested", "type": "AI", "score": 0, "gate": False},
                "H3.3": {"name": "Next steps communicated", "type": "AI", "score": 0, "gate": False}
            }}
        }

    def run_audit(self, transcript_text):
        rubric = self.get_full_rubric()
        lower_text = transcript_text.lower()
        
        # --- PASTE THE KEYWORD SCORING LOGIC FROM COLAB CELL 6 HERE ---
        if any(w in lower_text for w in ["today", "learn", "goal", "objective"]): 
            rubric["A"]["indicators"]["A1.1"]["score"] = 2
        
        if any(w in lower_text for w in ["well done", "good job"]): 
            rubric["C"]["indicators"]["C3.1"]["score"] = 2
            
        # --- CALCULATION LOGIC (Keep this to generate the OQI %) ---
        total_weighted_score = 0
        for domain in rubric.values():
            scores = [ind['score'] for ind in domain['indicators'].values()]
            avg = sum(scores) / len(scores) if scores else 0
            total_weighted_score += (avg / 2) * domain['weight']
        
        oqi = total_weighted_score * 100
        return {"oqi": round(oqi, 2), "results": rubric}