"""
services/engine/python_engine/health_check.py

STEP 6: diarization health check.

After processing, calculates what share of the transcript duration each
speaker label accounts for, and flags the recording when one label dominates
(>90%) - the classic symptom of collapsed diarization where both the tutor and
the student were merged into a single SPEAKER_00.
"""
from __future__ import annotations

from typing import Any, Dict, List

# One label covering more than this share of total spoken duration => suspect
DOMINANT_SHARE_THRESHOLD = 0.90


def speaker_duration_shares(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Per-speaker total duration + share of all speech (0-1)."""
    totals: Dict[str, float] = {}
    for s in segments or []:
        spk = s.get("speaker") or "SPEAKER_00"
        start = float(s.get("start") or 0)
        end = float(s.get("end") or 0)
        dur = max(0.0, end - start)
        totals[spk] = totals.get(spk, 0.0) + dur
    total = sum(totals.values())
    return [
        {
            "speaker": spk,
            "duration": round(dur, 2),
            "share": round(dur / total, 4) if total else 0.0,
        }
        for spk, dur in sorted(totals.items(), key=lambda kv: kv[0])
    ]


def check_diarization_health(segments: List[Dict[str, Any]],
                             threshold: float = DOMINANT_SHARE_THRESHOLD) -> Dict[str, Any]:
    """Returns:
    {
      "healthy": bool,
      "dominant_speaker": "SPEAKER_00",
      "dominant_share": 0.97,
      "threshold": 0.9,
      "speakers": [...],
      "reason": "..."   # only present when unhealthy
    }
    """
    shares = speaker_duration_shares(segments)
    result: Dict[str, Any] = {"healthy": True, "speakers": shares,
                              "threshold": threshold}
    if not shares:
        result["healthy"] = False
        result["reason"] = "no speaker segments produced"
        return result
    if len(shares) < 2:
        dominant = shares[0]
        result.update({"dominant_speaker": dominant["speaker"],
                       "dominant_share": dominant["share"]})
        if dominant["share"] > threshold:
            result["healthy"] = False
            result["reason"] = (
                f"single speaker '{dominant['speaker']}' covers "
                f"{int(dominant['share'] * 100)}% of the session "
                f"(expected two speakers in a 1:1 call)"
            )
        return result

    dominant = max(shares, key=lambda s: s["share"])
    result.update({"dominant_speaker": dominant["speaker"],
                   "dominant_share": dominant["share"]})
    if dominant["share"] > threshold:
        result["healthy"] = False
        result["reason"] = (
            f"'{dominant['speaker']}' covers {int(dominant['share'] * 100)}% of "
            f"spoken time; diarization likely collapsed both speakers"
        )
    return result