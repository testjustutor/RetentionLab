"""TEMP: fix pipeline.py indentation (line with `transcript = None`) and
apply the _align_diarization guard for assemblyai/channels backends.
Deleted after use. Run: python tmp_fix_pipeline.py
"""
import os, sys
p = r"C:\xampp\htdocs\RetentionLab\services\python_engine\pipeline.py"
with open(p, encoding="utf-8") as f:
    src = f.read()

# --- Fix 1: the `transcript = None` line that precedes the
#     `diarization: List[Dict[str, Any]] = []` line must sit at exactly 4-space
#     indent (run_pipeline function body). Reset it regardless of whatever
#     indentation accumulated.
lines = src.split("\n")
fixed = False
for i, line in enumerate(lines):
    if (line.strip() == "transcript = None"
            and i + 1 < len(lines)
            and lines[i + 1].startswith("    diarization: List[Dict[str, Any]] = []")):
        lines[i] = "    transcript = None"
        fixed = True
        break
if not fixed:
    print("WARN: transcript=None indent fix target not found")
    sys.exit(1)
src = "\n".join(lines)

# --- Fix 2: skip _align_diarization for assemblyai & channels backends
#     (segments already carry correct per-speaker labels; midpoint overlap
#     would trigger the collision/gap bug).
needle = (
    '    labeled_segments = _align_diarization(segments, diarization)\n'
    '    plain_text = "\\n".join(s["text"] for s in segments).strip()'
)
replacement = (
    '    # Segments from diarization-backed backends already carry correct per-speaker\n'
    '    # labels: `channels` (real per-mic audio) and `assemblyai` (real diarization\n'
    '    # or real channels). Re-deriving a label via midpoint overlap would hit the\n'
    '    # collision/gap bug (a segment whose midpoint lands in a timing gap gets\n'
    '    # force-reset to "Speaker 1"), so use them as-is and skip _align_diarization.\n'
    '    # WhisperX segments are also pre-labelled but their diarization spans are\n'
    '    # built FROM those same segments, so alignment there is a safe identity;\n'
    '    # left unchanged to avoid altering that path.\n'
    '    if transcript and transcript.get("backend") in ("assemblyai", "channels"):\n'
    '        labeled_segments = segments\n'
    '    else:\n'
    '        labeled_segments = _align_diarization(segments, diarization)\n'
    '    plain_text = "\\n".join(s["text"] for s in segments).strip()'
)
cnt = src.count(needle)
if cnt != 1:
    print(f"WARN: align-diarization needle matched {cnt} times, expected 1")
    sys.exit(1)
src = src.replace(needle, replacement)

with open(p, "w", encoding="utf-8") as f:
    f.write(src)
print("OK: transcript indent fixed =", fixed, "|| align-diarization guard applied")
