"""
services/python_engine/audit/report_scorer.py

Pure scoring logic for the observation report (matches the PDF). Each indicator
rating maps to a weight; category marks = sum, overall total = sum of category
scored marks, expressed out of TOTAL_MARKS. Red flags are reported separately
(not deducted), matching the PDF.

Rating -> numeric weight:
    Meets Expectations  = 1.0
    Partially Meets     = 0.6
    Needs Improvement   = 0.3
    Not Applicable      = excluded (does not count toward category marks)
"""
from typing import Any, Dict

from .report_schema import TOTAL_MARKS, build_empty_report, RATINGS

RATING_WEIGHT = {
    "Meets Expectations": 1.0,
    "Partially Meets": 0.6,
    "Needs Improvement": 0.3,
    "Not Applicable": None,  # excluded
}


def apply_ai_ratings(report: Dict[str, Any], ai_result: Dict[str, Any]) -> Dict[str, Any]:
    """Fill the report's indicator ratings from the AI response. The AI returns
    a flat map: {indicator_id: {rating, descriptor, notes}} or
    {indicator_id: "Meets Expectations"}. Scores are recomputed here."""
    src_ratings = ai_result.get("ratings") or {}
    if not isinstance(src_ratings, dict):
        src_ratings = {}

    for cat in report["categories"]:
        scored_marks = 0.0

        # PASS 1: resolve every indicator's rating first, and count how many
        # are usable (not "Not Applicable"). This used to be computed
        # incrementally inside the scoring loop below, which made an
        # indicator's `share` depend on how many later indicators in the
        # SAME category turned out to be N/A -- i.e. two "Meets Expectations"
        # indicators in the same category could get different scores purely
        # based on their position in the list. Resolving ratings up front
        # fixes that: every indicator's share is computed against the same,
        # final `usable` count.
        resolved = []
        usable = 0
        for ind in cat["indicators"]:
            entry = src_ratings.get(ind["id"])
            rating = None
            descriptor = ""
            notes = ""
            if isinstance(entry, dict):
                rating = entry.get("rating")
                descriptor = str(entry.get("rating_descriptor") or "").strip()
                notes = str(entry.get("additional_notes") or "").strip()
            elif isinstance(entry, str):
                rating = entry
            if rating not in RATING_WEIGHT:
                rating = "Not Applicable"
            weight = RATING_WEIGHT.get(rating)
            if weight is not None:
                usable += 1
            resolved.append((ind, rating, descriptor, notes, weight))

        # PASS 2: score each indicator against the final, fixed `usable` count.
        for ind, rating, descriptor, notes, weight in resolved:
            ind["rating"] = rating
            ind["rating_descriptor"] = descriptor
            ind["additional_notes"] = notes
            if weight is None:
                # Not Applicable is excluded from marks
                ind["score"] = 0.0
            else:
                share = cat["marks"] / usable if usable else 0.0
                ind["score"] = round(share * weight, 2)
                scored_marks += ind["score"]
        cat["scored_marks"] = round(scored_marks, 2)

    # Red flags
    flags = ai_result.get("red_flags") or {}
    for rf in report["red_flags"]:
        entry = flags.get(rf["id"])
        flagged = bool(entry)
        note = entry.get("note") if isinstance(entry, dict) else ""
        rf["flagged"] = flagged
        rf["note"] = str(note or "").strip()

    report["total_score"] = round(sum(c["scored_marks"] for c in report["categories"]), 2)
    report["total_marks"] = TOTAL_MARKS

    pct = report["total_score"] / TOTAL_MARKS if TOTAL_MARKS else 0
    if pct >= 0.9:
        report["rating_overall"] = "Excellent"
    elif pct >= 0.75:
        report["rating_overall"] = "Meets Expectations"
    elif pct >= 0.5:
        report["rating_overall"] = "Needs Improvement"
    else:
        report["rating_overall"] = "Critical / Needs Intervention"

    report["observer_comments"] = _as_list(ai_result.get("observer_comments"))
    report["recommendations"] = _as_list(ai_result.get("recommendations"))
    return report


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [value]
    return []