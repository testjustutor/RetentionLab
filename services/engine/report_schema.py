"""
services/engine/report_schema.py

Defines the full scored-observation structure that matches the PDF review
report (categories, marks, indicators, ratings, descriptors, additional notes,
red flags, total score, comments). Scoring math is recomputed in code.

Total marks across categories = 84, as in the PDF.
"""
from typing import Any, Dict, List

TOTAL_MARKS = 84

CATEGORIES: List[Dict[str, Any]] = [
    {"code": "A", "name": "Curriculum & Lesson Alignment", "marks": 12},
    {"code": "B", "name": "Instructional Delivery", "marks": 16},
    {"code": "C", "name": "Student Engagement & Interaction", "marks": 16},
    {"code": "D", "name": "Classroom Management & Professionalism", "marks": 12},
    {"code": "E", "name": "Student Learning Evidence & Closure", "marks": 12},
    {"code": "F", "name": "Communication & Cultural Sensitivity", "marks": 12},
]

INDICATORS: Dict[str, List[Dict[str, Any]]] = {
    "A": [
        {"id": "A1", "name": "Lesson Objective Clarity",
         "desc": "Learning outcomes are explicitly stated and aligned to the student's curriculum and level."},
        {"id": "A2", "name": "Resource Readiness",
         "desc": "Tutor uses pre-uploaded or well-prepared resources; no time wasted."},
        {"id": "A3", "name": "Curriculum Alignment",
         "desc": "Content reflects appropriate grade-level benchmarks and curriculum standards."},
        {"id": "A4", "name": "Concept Clarity & Accuracy",
         "desc": "Content is factually accurate and conceptually sound; tutor handles subject questions."},
    ],
    "B": [
        {"id": "B1", "name": "Scaffolding & Differentiation",
         "desc": "Concepts are broken down; tutor adapts instruction to the student's pace."},
        {"id": "B2", "name": "Use of Examples and Analogies",
         "desc": "Relevant, age-appropriate examples from the student's context."},
        {"id": "B3", "name": "Technology Usage",
         "desc": "Effective use of digital tools (whiteboard, screen share, polls)."},
        {"id": "B4", "name": "Tutor-Student Rapport",
         "desc": "Warmth, encouragement, and age-appropriate communication maintained."},
        {"id": "B5", "name": "Questioning Techniques",
         "desc": "Probing, open-ended questions to promote higher-order thinking."},
    ],
    "C": [
        {"id": "C1", "name": "Student Talk Time",
         "desc": "Adequate student participation; student prompted to explain reasoning."},
        {"id": "C2", "name": "Feedback & Encouragement",
         "desc": "Tutor gives constructive, specific feedback and praises effort."},
        {"id": "C3", "name": "Error Correction",
         "desc": "Prompt, clear, sensitive correction of student errors."},
    ],
    "D": [
        {"id": "D1", "name": "Time Management",
         "desc": "Session paced well with clear beginning, core, and wrap-up."},
        {"id": "D2", "name": "Professional Conduct",
         "desc": "Punctual, dressed appropriately, follows code of conduct."},
        {"id": "D3", "name": "Behavior Management",
         "desc": "Handles student distractions/reluctance calmly and productively."},
    ],
    "E": [
        {"id": "E1", "name": "Formative Checkpoints",
         "desc": "Checks understanding with mini-assessments, Q&A, or tasks."},
        {"id": "E2", "name": "Recap & Summary",
         "desc": "Ends with recap, highlighting key takeaways and next steps."},
        {"id": "E3", "name": "Homework/Practice Suggestions",
         "desc": "Relevant follow-up activities shared to reinforce learning."},
    ],
    "F": [
        {"id": "F1", "name": "Language & Pronunciation",
         "desc": "Clear pronunciation, neutral accent, subject-appropriate vocabulary."},
        {"id": "F2", "name": "Cross-cultural Awareness",
         "desc": "Avoids culturally unfamiliar references; uses inclusive language."},
        {"id": "F3", "name": "Parent Communication",
         "desc": "Tutor is prepared to share academic feedback or session summary where expected."},
    ],
}

RATINGS = ["Meets Expectations", "Partially Meets", "Not Applicable", "Needs Improvement"]

RED_FLAGS: List[Dict[str, Any]] = [
    {"id": "RF1", "name": "Internet/Tech Disruption"},
    {"id": "RF2", "name": "Tutor Disengagement"},
    {"id": "RF3", "name": "Student Left Unattended"},
    {"id": "RF4", "name": "Repeated Tardiness"},
    {"id": "RF5", "name": "Curriculum Mismatch"},
    {"id": "RF6", "name": "Misbehavior or Harsh Tone"},
    {"id": "RF7", "name": "Parent Complaint/Flagged Concern"},
    {"id": "RF8", "name": "Camera Usage"},
]


def build_empty_report() -> Dict[str, Any]:
    """Return a blank report skeleton with every category/indicator/red flag
    pre-populated. The AI fills ratings + notes; math stays in code."""
    categories = []
    for cat in CATEGORIES:
        indicators = []
        for ind in INDICATORS.get(cat["code"], []):
            indicators.append({
                "id": ind["id"],
                "name": ind["name"],
                "description": ind["desc"],
                "rating": None,
                "rating_descriptor": "",
                "additional_notes": "",
                "score": 0.0,
            })
        categories.append({
            "code": cat["code"],
            "name": cat["name"],
            "marks": cat["marks"],
            "scored_marks": 0.0,
            "indicators": indicators,
        })
    return {
        "report_type": "tutor_observation_report",
        "meta": {
            "tutor_name": "",
            "student_name": "",
            "session_date": "",
            "session_time": "",
            "session_type": "Regular Session",
            "review_date": "",
            "reviewer": "",
        },
        "categories": categories,
        "red_flags": [{"id": rf["id"], "name": rf["name"], "flagged": False,
                       "note": ""} for rf in RED_FLAGS],
        "total_score": 0.0,
        "total_marks": TOTAL_MARKS,
        "rating_overall": "",
        "observer_comments": [],
        "recommendations": [],
    }