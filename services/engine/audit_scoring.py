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
from typing import Any, Dict, Iterable, List, Tuple

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


# ---------------------------------------------------------------------------
# Review-calculation-logic formulas (review_calculation_logic.txt)
#
# STATUS VALUES (identical everywhere): 1 = Met, 2 = Not Met, 3 = Not Applicable
#
#   submit (TutorEvaluationSubmit grid)  -> Met / (Met + Not Applicable) x 100,
#          all-Not-Applicable category scored 100%.
#   update (feedback-update grid)        -> Met / (Met + Not Met) x 100,
#          all-Not-Met category (incorrectly) scored 100% — the documented
#          swap of the count_2/count_3 mapping between the two flows.
#
# The two flows produce DIFFERENT category scores for the same statuses, so the
# stored rollups (ai_audit_category_scores / ai_audit_overall_summary) carry a
# calc_source column ('submit' | 'update') to say which formula produced them.
# ---------------------------------------------------------------------------
def compute_category_score_from_counts(met, not_met, na, calc_source="submit"):
    """Compute a per-category percentage from raw status counts.

    met/not_met/na are the counts of status 1/2/3 in the category.
    calc_source 'update' swaps the denominator (the documented quirk): the
    denominator becomes Met + Not Met instead of Met + Not Applicable.
    """
    met = int(met or 0)
    not_met = int(not_met or 0)
    na = int(na or 0)
    total = met + not_met + na

    if calc_source == "update":
        # Met / (Met + Not Met) x 100 — all-Not-Met category (incorrectly) 100%.
        if total > 0 and not_met == total:
            return 100.0
        denom = met + not_met
    else:
        # submit — Met / (Met + Not Applicable) x 100 — all-NA category 100%.
        if total > 0 and na == total:
            return 100.0
        denom = met + na

    if denom == 0:
        return 0.0
    return round((met / denom) * 100, 2)


def compute_overall_from_category_rows(category_rows):
    """Final (overall) score from a list of (category_score, category_total_criteria).

    Per review_calculation_logic.txt this is IDENTICAL in both submit/update
    flows and weights by criteria COUNT per category (never a configured
    category weight):

        total_weighted_percent += category_score * total_criteria_in_category
        total_criteria_all     += total_criteria_in_category
        Final Score = total_weighted_percent / total_criteria_all   (0 if 0)
    """
    total_weighted_percent = 0.0
    total_criteria_all = 0
    for score, total in category_rows:
        total_weighted_percent += float(score or 0) * int(total or 0)
        total_criteria_all += int(total or 0)
    return round(total_weighted_percent / total_criteria_all, 2) if total_criteria_all else 0.0


# ---------------------------------------------------------------------------
# Config-driven calculation ("requires_calculation" indicators)
#
# An indicator flagged requires_calculation is never sent to the AI. Instead
# its status is derived here by comparing a named metric (built by
# audit_metrics.build_calculation_context) against a threshold, per the
# indicator's OWN calculation_config JSON - e.g.
#   {"metric": "talk_ratio_tutor_pct", "operator": "<=", "threshold": 40}
# Nothing here ever references a specific indicator id/name/code: which
# indicators use this path, which metric they read, and what threshold
# applies are all configuration, so a new calculated indicator - or a
# changed threshold on an existing one - never requires a code change.
# ---------------------------------------------------------------------------
_CALCULATION_OPERATORS = {
    ">=": lambda value, threshold: value >= threshold,
    "<=": lambda value, threshold: value <= threshold,
    ">": lambda value, threshold: value > threshold,
    "<": lambda value, threshold: value < threshold,
    "==": lambda value, threshold: value == threshold,
    "!=": lambda value, threshold: value != threshold,
    "between": lambda value, threshold: threshold[0] <= value <= threshold[1],
}


def resolve_calculation(calculation_config, metrics_context) -> Dict[str, Any]:
    """Evaluate one indicator's calculation_config against the available
    metrics_context (see audit_metrics.build_calculation_context).

    Returns {"status": STATUS_MET|STATUS_NOT_MET|STATUS_NOT_APPLICABLE,
             "reason": <human-readable explanation>,
             "metric_value": <float or None>}.

    Falls back to STATUS_NOT_APPLICABLE - never raises, never silently
    counts as a failure - whenever the config is missing/malformed, the
    named metric isn't available for this run, or the operator/threshold
    can't be evaluated. This mirrors how a requires_video indicator is
    marked N/A when video evidence isn't available: an unresolvable
    calculation is "not observable this run", not "Not Met".
    """
    if not isinstance(calculation_config, dict):
        return {
            "status": STATUS_NOT_APPLICABLE,
            "reason": "no calculation configured for this indicator",
            "metric_value": None,
        }

    metric_name = calculation_config.get("metric")
    operator = str(calculation_config.get("operator") or "").strip().lower()
    threshold = calculation_config.get("threshold")

    metrics_context = metrics_context or {}
    metric_value = metrics_context.get(metric_name) if metric_name else None

    if metric_value is None:
        return {
            "status": STATUS_NOT_APPLICABLE,
            "reason": f"metric '{metric_name}' not available for this session",
            "metric_value": None,
        }

    operator_fn = _CALCULATION_OPERATORS.get(operator)
    if operator_fn is None:
        return {
            "status": STATUS_NOT_APPLICABLE,
            "reason": f"unsupported calculation operator '{operator}'",
            "metric_value": metric_value,
        }

    try:
        if operator == "between":
            threshold_value = [float(t) for t in threshold]
            if len(threshold_value) != 2:
                raise ValueError("between requires a [min, max] threshold")
        else:
            threshold_value = float(threshold)
        passed = bool(operator_fn(float(metric_value), threshold_value))
    except (TypeError, ValueError, IndexError):
        return {
            "status": STATUS_NOT_APPLICABLE,
            "reason": f"invalid threshold for metric '{metric_name}'",
            "metric_value": metric_value,
        }

    return {
        "status": STATUS_MET if passed else STATUS_NOT_MET,
        "reason": f"{metric_name}={metric_value} {operator} {threshold} -> {'Met' if passed else 'Not Met'}",
        "metric_value": metric_value,
    }