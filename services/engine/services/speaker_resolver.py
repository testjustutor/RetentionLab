# services/engine/services/speaker_resolver.py

"""
speaker_resolver.py
===================
Resolves SPEAKER_XX labels to real names using the Teams captions
transcript. Designed to be called inside transcription_task.py immediately
after diarization completes and BEFORE transcript_builder runs.

Usage inside transcription_task.py
-----------------------------------
    from speaker_resolver import SpeakerResolver

    resolver = SpeakerResolver(
        teams_trans_path=context.teams_trans_path,
        meeting_start=context.meeting_start,   # datetime or None
    )
    diar_segments = resolver.resolve(diar_segments)
    # diar_segments[i]['speaker'] is now 'Abram Khan' instead of 'SPEAKER_01'

How it works
------------
1. Parse Teams TRANS_*.txt → {wall_time, real_name, text} per line.
2. Two-pass offset calibration:
     Pass 1: maximize overlap count  (wall = meeting_start + diar_sec + offset)
     Pass 2: among top-5, pick offset with highest cumulative text similarity
3. Majority-vote speaker map from timestamp-overlapping lines.
4. Soft-vote fallback (closest line within GAP_FALLBACK_SEC) for pre-Teams gap.
5. Text-similarity fallback for any still-unmapped labels.
6. Patch diar_segments in-place; preserve original label in 'speaker_label' field.
"""

import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TEAMS_LINE_RE   = re.compile(r"\[(\d+:\d+:\d+\s*[AP]M)\]\s+(.+?):\s*(.*)")
GM_LINE_RE      = re.compile(r"\[(\d{1,2}:\d{2}:\d{2})\]\s+(.+?):\s*(.*)")
HEADER_DATE_RE  = re.compile(r"Date\s*:\s*(\d+/\d+/\d+),?\s+(\d+:\d+:\d+\s*[AP]m)\s*", re.IGNORECASE)
TIME_FMT        = "%I:%M:%S %p"
TIME_FMT_24     = "%H:%M:%S"
OFFSET_LOW      = -10.0    # seconds
OFFSET_HIGH     = 60.0     # seconds
OFFSET_STEP     = 0.5      # seconds
GAP_FALLBACK    = 35.0     # max distance (s) for soft closest-line vote
SIM_THRESHOLD   = 0.30     # minimum text similarity for text-fallback vote
TOP_N_OFFSETS   = 5        # number of top-count offsets to re-rank by similarity


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _parse_teams_file(path: str) -> tuple[list[dict], datetime | None]:
    raw = Path(path).read_text(encoding="utf-8")
    meeting_start = None
    m = HEADER_DATE_RE.search(raw)
    if m:
        try:
            # Try month-first first (Teams style), else day-first (Google Meet style)
            for fmt in ("%m/%d/%Y %I:%M:%S %p", "%d/%m/%Y %I:%M:%S %p"):
                try:
                    meeting_start = datetime.strptime(f"{m.group(1)} {m.group(2)}", fmt)
                    break
                except ValueError:
                    continue
        except ValueError:
            pass
    lines = []
    for match in TEAMS_LINE_RE.finditer(raw):
        try:
            t = datetime.strptime(match.group(1).strip(), TIME_FMT)
        except ValueError:
            continue
        lines.append({"time": t, "speaker": match.group(2).strip(), "text": match.group(3).strip()})
    # If no 12h lines matched, try the 24-hour Google Meet caption format
    if not lines:
        for match in GM_LINE_RE.finditer(raw):
            try:
                t = datetime.strptime(match.group(1).strip(), TIME_FMT_24)
            except ValueError:
                continue
            lines.append({"time": t, "speaker": match.group(2).strip(), "text": match.group(3).strip()})
    return lines, meeting_start


def _sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


# ---------------------------------------------------------------------------
# Two-pass offset calibration
# ---------------------------------------------------------------------------

def _calibrate_offset(diar_segs: list[dict], teams: list[dict], meeting_start: datetime) -> float:
    """
    Pass 1: for each candidate offset, count how many diar segments overlap a Teams line.
    Pass 2: from the top-N offsets by count, pick the one with the highest text similarity.
    Returns the best offset in seconds.
    """
    count_map: dict[float, int] = {}
    off = OFFSET_LOW
    while off <= OFFSET_HIGH:
        count = sum(
            1 for seg in diar_segs
            if any(
                (meeting_start + timedelta(seconds=seg["start"] + off)) <= t["time"] <=
                (meeting_start + timedelta(seconds=seg["end"]   + off))
                for t in teams
            )
        )
        count_map[off] = count
        off = round(off + OFFSET_STEP, 2)

    # Top-N by overlap count
    top_offsets = sorted(count_map, key=lambda x: count_map[x], reverse=True)[:TOP_N_OFFSETS]

    # Re-rank by cumulative text similarity
    best_off, best_sim = top_offsets[0], -1.0
    for off in top_offsets:
        sim_total = 0.0
        for seg in diar_segs:
            ws = meeting_start + timedelta(seconds=seg["start"] + off)
            we = meeting_start + timedelta(seconds=seg["end"]   + off)
            win = [t for t in teams if ws <= t["time"] <= we]
            if win:
                sim_total += max(_sim(seg["text"], t["text"]) for t in win)
        if sim_total > best_sim:
            best_sim = sim_total
            best_off = off

    return best_off


# ---------------------------------------------------------------------------
# Core SpeakerResolver
# ---------------------------------------------------------------------------

class SpeakerResolver:
    """
    Resolves SPEAKER_XX labels → real speaker names.

    Parameters
    ----------
    teams_trans_path : str | Path
        Path to Teams captions .txt (TRANS_*.txt).
    meeting_start : datetime | None
        Wall-clock start of the meeting. Extracted from Teams header if None.
    forced_offset : float | None
        Skip auto-calibration and use this fixed offset (seconds).
    verbose : bool
        Print resolution details.
    """

    def __init__(
        self,
        teams_trans_path: str,
        meeting_start: "datetime | None" = None,
        forced_offset: "float | None" = None,
        verbose: bool = False,
    ):
        self.verbose = verbose
        self.teams_lines, header_start = _parse_teams_file(str(teams_trans_path))

        if not self.teams_lines:
            raise ValueError(
                f"No Teams transcript lines parsed from: {teams_trans_path}\n"
                "Expected format: [4:02:24 PM] Speaker Name: text"
            )

        if meeting_start is not None:
            self.meeting_start = meeting_start
        elif header_start is not None:
            self.meeting_start = header_start
        else:
            self.meeting_start = self.teams_lines[0]["time"]
            if verbose:
                print(f"[SpeakerResolver] No meeting start in header; "
                      f"using first Teams line: {self.meeting_start}")

        self.forced_offset = forced_offset
        self._offset: "float | None" = None
        self._speaker_map: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def resolve(self, diar_segments: list[dict]) -> list[dict]:
        """
        Patch 'speaker' field of each segment with the real name.
        Adds 'speaker_label' field preserving the original SPEAKER_XX value.
        Mutates and returns the input list.
        """
        if not diar_segments:
            return diar_segments

        # 1. Offset
        if self.forced_offset is not None:
            self._offset = self.forced_offset
            if self.verbose:
                print(f"[SpeakerResolver] Offset (forced): {self._offset}s")
        else:
            self._offset = _calibrate_offset(diar_segments, self.teams_lines, self.meeting_start)
            if self.verbose:
                print(f"[SpeakerResolver] Offset (auto-calibrated): {self._offset}s")

        # 2. Timestamp majority vote
        self._speaker_map = self._vote_by_timestamp(diar_segments)

        # 3. Text-similarity fallback for unmapped labels
        self._speaker_map = self._fallback_text_sim(diar_segments, self._speaker_map)

        if self.verbose:
            print("[SpeakerResolver] Speaker mapping:")
            for label, name in sorted(self._speaker_map.items()):
                print(f"  {label} → {name}")
            unmapped = {s["speaker"] for s in diar_segments} - set(self._speaker_map)
            if unmapped:
                print(f"  Unmapped (kept as-is): {unmapped}")

        # 4. Patch in-place
        for seg in diar_segments:
            seg["speaker_label"] = seg["speaker"]
            seg["speaker"] = self._speaker_map.get(seg["speaker"], seg["speaker"])

        return diar_segments

    @property
    def speaker_map(self) -> dict[str, str]:
        return dict(self._speaker_map)

    @property
    def offset(self) -> "float | None":
        return self._offset

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _wall(self, start: float, end: float) -> tuple:
        ws = self.meeting_start + timedelta(seconds=start + self._offset)
        we = self.meeting_start + timedelta(seconds=end   + self._offset)
        return ws, we

    def _vote_by_timestamp(self, segs: list[dict]) -> dict[str, str]:
        votes: dict[str, Counter] = defaultdict(Counter)
        for seg in segs:
            ws, we = self._wall(seg["start"], seg["end"])
            in_win = [t for t in self.teams_lines if ws <= t["time"] <= we]
            if in_win:
                for t in in_win:
                    votes[seg["speaker"]][t["speaker"]] += 1
            else:
                closest = min(self.teams_lines, key=lambda t: abs((t["time"] - ws).total_seconds()))
                dist = abs((closest["time"] - ws).total_seconds())
                if dist <= GAP_FALLBACK:
                    votes[seg["speaker"]][closest["speaker"]] += 0.5
        return {lbl: ctr.most_common(1)[0][0] for lbl, ctr in votes.items() if ctr}

    def _fallback_text_sim(self, segs: list[dict], smap: dict[str, str]) -> dict[str, str]:
        unmapped = {s["speaker"] for s in segs if s["speaker"] not in smap}
        if not unmapped:
            return smap
        extra: dict[str, Counter] = defaultdict(Counter)
        for seg in segs:
            if seg["speaker"] not in unmapped:
                continue
            for t in self.teams_lines:
                sim = _sim(seg["text"], t["text"])
                if sim >= SIM_THRESHOLD:
                    extra[seg["speaker"]][t["speaker"]] += sim
        for lbl, ctr in extra.items():
            if ctr:
                smap[lbl] = ctr.most_common(1)[0][0]
        return smap


# ---------------------------------------------------------------------------
# Utility: find Teams transcript from a DIAR path
# ---------------------------------------------------------------------------

def find_teams_trans(diar_path: str, search_dirs: "list[str] | None" = None) -> "str | None":
    """
    Given a DIAR_*.json path, locate the matching TRANS_*.txt by meeting ID.
    Searches same dir, provided search_dirs, and parent dir.
    """
    diar = Path(diar_path)
    stem = diar.stem
    meeting_id_part = stem[5:] if stem.startswith("DIAR_") else stem

    dirs = [diar.parent]
    if search_dirs:
        dirs.extend(Path(d) for d in search_dirs)
    dirs.append(diar.parent.parent)

    for d in dirs:
        for candidate in sorted(d.glob("TRANS_*.txt")):
            cid = candidate.stem[6:] if candidate.stem.startswith("TRANS_") else candidate.stem
            # Strip trailing _N chunk suffix for comparison
            import re
            norm = lambda s: re.sub(r"_\d+$", "", s)
            if norm(meeting_id_part) in norm(cid) or norm(cid) in norm(meeting_id_part):
                return str(candidate)
    return None