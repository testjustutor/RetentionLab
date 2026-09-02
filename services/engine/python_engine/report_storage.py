"""
services/engine/python_engine/audit/report_storage.py

Writes the scored observation report to
    <project>/storage/video_diarization/<audio_base>.report.json

Also writes a readable .txt summary. File naming is distinct from the
diarization transcript files.
"""
import json
import os
from typing import Any, Dict, Optional

from utils.logger_util import log_with_type


def _default_output_dir() -> str:
    project_root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
    return os.path.join(project_root, "storage", "video_diarization")


def save_report_file(report: Dict[str, Any], audio_name: Optional[str] = None,
                     output_dir: Optional[str] = None) -> Optional[str]:
    if not report:
        return None
    out_dir = output_dir or _default_output_dir()
    try:
        os.makedirs(out_dir, exist_ok=True)
        base = audio_name or "report"
        base = os.path.splitext(os.path.basename(base))[0]

        json_path = os.path.join(out_dir, f"{base}.report.json")
        with open(json_path, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=2)

        txt_path = os.path.join(out_dir, f"{base}.report.txt")
        with open(txt_path, "w", encoding="utf-8") as fh:
            fh.write(_to_text(report))

        log_with_type("info", f"audit/report: saved -> {json_path}", "PYTHON_ENGINE")
        return json_path
    except Exception as e:
        log_with_type("error", f"audit/report: failed to save report file -> {e}", "PYTHON_ENGINE")
        return None


def _to_text(report: Dict[str, Any]) -> str:
    lines = []
    meta = report.get("meta", {})
    lines.append("TUTOR OBSERVATION REPORT")
    lines.append("========================")
    if meta.get("tutor_name"):
        lines.append(f"Tutor      : {meta.get('tutor_name')}")
    if meta.get("student_name"):
        lines.append(f"Student    : {meta.get('student_name')}")
    if meta.get("session_date"):
        lines.append(f"Session    : {meta.get('session_date')} {meta.get('session_time', '')}")
    if meta.get("reviewer"):
        lines.append(f"Reviewer   : {meta.get('reviewer')}")
    if meta.get("review_date"):
        lines.append(f"Reviewed   : {meta.get('review_date')}")
    lines.append(f"Overall    : {report.get('rating_overall')}")
    lines.append(f"Total      : {report.get('total_score')} / {report.get('total_marks')}")
    lines.append("")

    for cat in report.get("categories", []):
        lines.append(f"[{cat['code']}] {cat['name']}  ({cat['scored_marks']}/{cat['marks']})")
        lines.append("-" * 60)
        for ind in cat.get("indicators", []):
            rating = ind.get("rating") or "N/A"
            lines.append(f"  {ind['id']} {ind['name']} -> {rating}")
            if ind.get("rating_descriptor"):
                lines.append(f"      {ind['rating_descriptor']}")
            if ind.get("additional_notes"):
                lines.append(f"      * {ind['additional_notes']}")
        lines.append("")

    lines.append("RED FLAGS")
    lines.append("---------")
    for rf in report.get("red_flags", []):
        mark = "FLAGGED" if rf.get("flagged") else "ok"
        note = f" - {rf.get('note')}" if rf.get("note") else ""
        lines.append(f"  [{mark}] {rf['name']}{note}")

    if report.get("observer_comments"):
        lines.append("")
        lines.append("OBSERVER COMMENTS")
        lines.append("-----------------")
        for c in report["observer_comments"]:
            lines.append(f"  - {c}")
    if report.get("recommendations"):
        lines.append("")
        lines.append("RECOMMENDATIONS")
        lines.append("---------------")
        for r in report["recommendations"]:
            lines.append(f"  - {r}")
    lines.append("")
    return "\n".join(lines)