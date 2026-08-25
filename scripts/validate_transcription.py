"""
scripts/validate_transcription.py  (run from project root)

STEP 7: Validation - run the python_engine pipeline against a recording and
compare its output against the Microsoft-Teams generated VTT captions for the
same session, reporting:
    a) % of segments where the speaker label matches the VTT speaker
    b) Word Error Rate (WER) between transcribed text and VTT text

Usage:
    .venv\\Scripts\\python.exe scripts\\validate_transcription.py <audio.mp3> <captions.vtt>

Requires: jiwer for WER (pip install jiwer) - falls back to a simple
Levenshtein-based WER if jiwer is missing.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.python_engine.pipeline import run_pipeline  # noqa: E402


def parse_vtt(path):
    """Parse a WebVTT file into [{start, end, speaker, text}]."""
    cue_re = re.compile(
        r"(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})"
    )
    name_re = re.compile(r"<v\s+([^>]+)>", re.IGNORECASE)
    cues = []
    cur = None
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.strip()
            m = cue_re.match(line)
            if m:
                g = [int(x) for x in m.groups()]
                start = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000.0
                end = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000.0
                if cur:
                    cues.append(cur)
                cur = {"start": start, "end": end, "speaker": "", "text": ""}
                continue
            if not line or line == "WEBVTT" or line.isdigit():
                continue
            if cur is not None:
                nm = name_re.search(line)
                if nm:
                    cur["speaker"] = nm.group(1).strip()
                    line = name_re.sub("", line).strip()
                # strip remaining vtt tags
                clean = re.sub(r"<[^>]+>", "", line).strip()
                cur["text"] = (cur["text"] + " " + clean).strip()
    if cur:
        cues.append(cur)
    return [c for c in cues if c.get("text")]


def _wer(ref_tokens, hyp_tokens):
    """Simple Levenshtein WER on token lists."""
    import importlib.util
    if importlib.util.find_spec("jiwer"):
        try:
            import jiwer
            return float(jiwer.wer(" ".join(ref_tokens), " ".join(hyp_tokens)))
        except Exception:
            pass

    n, m = len(ref_tokens), len(hyp_tokens)
    dp = list(range(m + 1))
    for i in range(1, n + 1):
        prev = dp[0]
        dp[0] = i
        for j in range(1, m + 1):
            tmp = dp[j]
            cost = 0 if ref_tokens[i - 1] == hyp_tokens[j - 1] else 1
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + cost)
            prev = tmp
    return (dp[m] / n) if n else 0.0


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    audio_path, vtt_path = sys.argv[1], sys.argv[2]

    print("[validate] running pipeline on:", audio_path)
    result = run_pipeline(audio_path)
    if not result.get("success"):
        print("[validate] pipeline failed:", result.get("error"))
        sys.exit(1)

    vtt = parse_vtt(vtt_path)
    print(f"[validate] VTT cues: {len(vtt)} | engine segments: {len(result['segments'])}")

    # ---- Speaker match: overlap midpoint against VTT cue speaker ----
    matched = total = 0
    for seg in result["segments"]:
        mid = (float(seg["start"]) + float(seg["end"])) / 2.0
        speaker = None
        for cue in vtt:
            if cue["start"] <= mid <= cue["end"]:
                speaker = cue["speaker"]
                break
        if not speaker:
            continue
        total += 1
        # Compare last-token of VTT speaker names too (e.g. 'Neeraj' vs full)
        eng = str(seg.get("speaker", "")).lower()
        ref = str(speaker).lower().split()[-1] if speaker else ""
        if ref and (ref in eng or eng.endswith(ref)):
            matched += 1
    pct_match = round(matched / total * 100, 1) if total else None

    # ---- WER: engine text vs concatenated VTT text over overlapping window ----
    vtt_text = " ".join(c["text"] for c in vtt).lower()
    vtt_text = re.sub(r"[^a-z0-9 ]", "", vtt_text).split()
    engine_text = (result.get("plain_text") or "").lower()
    engine_text = re.sub(r"[^a-z0-9 ]", "", engine_text).split()
    wer = _wer(vtt_text, engine_text) if vtt_text else None

    health = result.get("diarization_health") or {}

    print("\n================ VALIDATION RESULT ================")
    print(f"VTT cues                 : {len(vtt)}")
    print(f"Engine segments          : {len(result['segments'])}")
    print(f"Speaker label match      : {pct_match}% ({matched}/{total})")
    print(f"Word Error Rate (WER)    : {round(wer * 100, 1) if wer is not None else 'n/a'}%")
    print(f"Diarization healthy      : {health.get('healthy')}")
    print(f"Dominant speaker share   : {int((health.get('dominant_share') or 0) * 100)}%")
    if health.get("reason"):
        print(f"Health note              : {health['reason']}")
    print(f"Backend                  : {result.get('whisper_backend')}")
    print("===================================================\n")


if __name__ == "__main__":
    main()