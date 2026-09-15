"""
services/engine/audit_metrics.py

Builds the named-metric context that config-driven "calculated" rubric
indicators are evaluated against (see audit_scoring.py::resolve_calculation
and audit_service.py). This is the ONLY place that knows how to turn raw
pipeline data (transcript text, talk_ratio) into named numeric metrics -
everything downstream just looks a name up in the dict it returns, so
adding a new rubric indicator that reads an EXISTING metric never touches
Python: the rubric's calculation_config simply names the metric.

Metric names currently exposed:
    word_count              - words in the transcript
    transcript_char_count   - characters in the transcript
    talk_ratio_<key>        - every numeric key present in the talk_ratio
                               dict handed in from the pipeline (e.g.
                               talk_ratio_tutor_pct, talk_ratio_student_pct),
                               named generically off whatever keys that dict
                               actually has - never a fixed, hardcoded list.

A metric that isn't available for a given run (e.g. talk_ratio wasn't
computed because diarization didn't run) is simply absent from the
returned dict; resolve_calculation() in audit_scoring.py treats a missing
metric as "Not Applicable", never as a failure.
"""
from typing import Any, Dict, Optional


def build_calculation_context(transcript_text: Optional[str], talk_ratio: Optional[dict] = None) -> Dict[str, float]:
    """Build the {metric_name: numeric_value} context for this audit run."""
    transcript_text = transcript_text or ""
    context: Dict[str, float] = {
        "word_count": float(len(transcript_text.split())),
        "transcript_char_count": float(len(transcript_text)),
    }

    if isinstance(talk_ratio, dict):
        for key, value in talk_ratio.items():
            if isinstance(value, bool):
                continue
            if isinstance(value, (int, float)):
                context[f"talk_ratio_{key}"] = float(value)

    return context
