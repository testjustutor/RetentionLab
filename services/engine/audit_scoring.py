"""
services/engine/audit_scoring.py

Single source of truth for rubric scoring math — shared by every audit path
(audit_service.py, audit_worker.py, tutor_eval_worker.py) so the
Met/Not-Met/Not-Applicable -> category % -> weighted overall % calculation
is IDENTICAL everywhere instead of three slightly different formulas.

STATUS CODES:
    1 = Met
    2 = Not Met
    3 = Not Applicable

CATEGORY SCORE:
    Category Score = Met / (criteria excluding Not Met) x 100
                    = Met / (Met + Not Applicable) x 100

    - If ALL criteria in the category are Not Applicable -> 100%.
    - If the denominator (Met + Not Applicable) is 0 -> 0%.

FINAL (OVERALL) SCORE:
    Weighted sum = Sum( category_score x category_weight )
    Final score  = Weighted sum / Sum( category_weight )

    Weighted by each category's `weight` (cat_score) field — NEVER by the
    number of criteria in that category.
"""
from typing import Iterable, List, Tuple

STATUS_MET = 1
STATUS_NOT_MET = 2
STATUS_NOT_APPLICABLE = 3


def status_code_from_rating(rating) -> int:
    """Normalize any rating representation ('Met', 1/0/None, 'N/A', etc.)
    into a status code (1/2/3)."""
    if rating is None:
        return STATUS_NOT_APPLICABLE
    if isinstance(rating, (int, float)):
        return STATUS_MET if rating >= 1 else STATUS_NOT_MET
    r = str(rating).strip().lower()
    if r in ("met", "1", "true"):
        return STATUS_MET
    if r in ("not met", "not_met", "0", "false"):
        return STATUS_NOT_MET
    return STATUS_NOT_APPLICABLE


def compute_category_score(statuses) -> float:
    """Met / (Met + Not Applicable) x 100.

    - All-Not-Applicable category -> 100% (denom == met, met == 0 -> handled
      by the explicit denom==0 guard below only when there are literally no
      statuses at all; an all-NA category has met=0, na=len(statuses), so
      denom = na > 0 and the result correctly comes out to 0/na = 0%... )

    NOTE: per the module docstring, an all-Not-Applicable category should
    score 100%, not 0%. met=0 and na=total in that case, giving 0/total=0%,
    which is WRONG per spec. Handle that case explicitly before the general
    division.
    """
    total = len(statuses)
    met = sum(1 for s in statuses if s == STATUS_MET)
    na = sum(1 for s in statuses if s == STATUS_NOT_APPLICABLE)

    if total > 0 and na == total:
        # Every criterion in this category is Not Applicable -> 100%.
        return 100.0

    denom = met + na  # excludes Not Met
    if denom == 0:
        # No Met and no Not Applicable criteria to score against
        # (e.g. every criterion came back Not Met, or there were no
        # criteria at all) -> 0%, never a ZeroDivisionError.
        return 0.0

    return round((met / denom) * 100, 2)


def compute_weighted_overall(category_scores: Iterable[Tuple[float, float]]) -> float:
    """Weighted average of (score, weight) pairs, weighted by category
    weight (never by criteria count). Returns 0.0 when there is nothing
    to average (empty input or all weights are 0)."""
    num = 0.0
    den = 0.0
    for score, weight in category_scores:
        weight = float(weight or 0)
        num += float(score or 0) * weight
        den += weight
    return round(num / den, 2) if den else 0.0