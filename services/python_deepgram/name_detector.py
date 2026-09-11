"""
services/python_deepgram/name_detector.py

Detects the student's real name from a diarized Deepgram transcript, using
only local Python libraries (no LLM calls, no network access beyond the
one-time spaCy model download at install time).

Speakers arriving here are already labelled "Tutor"/"Student" by
transcriber._apply_role_labels() (most talk-time = Tutor). This module does
NOT touch that labelling - it only tries to recover the actual proper name
hiding behind the generic "Student" role label, e.g. so a transcript that
currently reads:

    [0.00 - 2.10] Tutor: Hi Priya, can you hear me okay?
    [2.30 - 4.00] Student: Yes, I can hear you fine.

can also report student_name="Priya".

STRATEGY (two passes, cheapest/most-precise first):

1. Regex "cue" pass (services/python_deepgram/name_detector.py's
   _regex_candidates): looks for the small set of fixed phrasings people
   actually use to name each other on a call - greetings/vocatives
   ("hi/hello/hey <name>", "<name>, how are you", "am I speaking with
   <name>") said BY THE TUTOR (they're addressing the student), and
   self-introductions ("my name is <name>", "this is <name>", "I'm <name>")
   said BY THE STUDENT (they're naming themselves). This deliberately does
   NOT require the captured word to already be capitalized - Deepgram only
   capitalizes words it recognizes as proper nouns, and uncommon names are
   exactly the ones most likely to come back lowercase or slightly
   misheard, so relying on capitalization would silently miss them. A
   stopword list filters out the common non-name words that land in the
   same sentence position ("hi there", "hi everyone", "this is fine").

2. spaCy NER fallback (_spacy_candidates): only runs when pass 1 finds
   nothing. Scans the full transcript for PERSON entities and scores them
   by frequency + how early they appear (introductions happen early).
   Requires the optional `spacy` dependency + `en_core_web_sm` model; if
   either isn't installed, this pass is skipped (logged once) rather than
   raising - name detection is a nice-to-have, it must never break
   transcription.

Returns a dict: {"student_name": str | None, "confidence": "high"|"medium"|
"low"|None, "source": "regex_cue" | "spacy_ner" | None}.
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from utils.logger_util import log_with_type

# Words that legitimately follow a greeting/vocative cue but are not names -
# filters out the most common false positives from pass 1 (case-insensitive).
_STOPWORDS = {
    "there", "everyone", "everybody", "guys", "team", "all", "folks", "class",
    "students", "sir", "maam", "ma'am", "miss", "mister", "mr", "mrs", "ms",
    "good", "again", "back", "so", "yes", "no", "yeah", "yep", "nope", "okay",
    "ok", "well", "um", "uh", "uhh", "umm", "here", "today", "now", "again",
    "how", "what", "this", "that", "it", "fine", "great", "good", "buddy",
    "friend", "dear", "kids", "kiddo", "champ",
    # Pronouns/function words that can land right after a greeting comma
    # ("hi, my name is X") and would otherwise be mistaken for the name
    # itself by the vocative pattern.
    "my", "your", "our", "i", "im", "you", "we", "he", "she", "they", "the",
    "a", "an", "and", "but", "just", "actually", "really", "also", "not",
    "still", "let's", "lets",
    # Auxiliary/modal verbs - can otherwise slip into the capture group of
    # the "hi/hello, <word>" pattern when a greeting is immediately followed
    # by a question ("hello, am I speaking with...") rather than a name.
    "am", "is", "are", "was", "were", "do", "did", "does", "can", "could",
    "would", "should", "will", "shall", "may", "might", "must", "has",
    "have", "had", "let", "please",
}

# Deepgram role labels - never valid name candidates even if matched literally.
_ROLE_LABELS = {"tutor", "student"}

# Pass 1a: vocative/greeting patterns - tutor addressing the student by name.
# Captures a single word (first name); apostrophes/hyphens allowed for names
# like "D'Souza" or "Anne-Marie".
_VOCATIVE_PATTERNS = [
    re.compile(r"\b(?:hi|hey|hello)\s*[,]?\s+([A-Za-z][A-Za-z'\-]{1,24})\b", re.IGNORECASE),
    re.compile(r"\bhow are you[,]?\s+([A-Za-z][A-Za-z'\-]{1,24})\s*[?.!]?", re.IGNORECASE),
    re.compile(r"\b(?:am i (?:speaking|talking) (?:with|to)|is this)\s+([A-Za-z][A-Za-z'\-]{1,24})\b", re.IGNORECASE),
    re.compile(r"\byou must be\s+([A-Za-z][A-Za-z'\-]{1,24})\b", re.IGNORECASE),
    re.compile(r"\bnice to (?:meet|see) you[,]?\s+([A-Za-z][A-Za-z'\-]{1,24})\b", re.IGNORECASE),
    re.compile(r"\bcan you hear me[,]?\s+([A-Za-z][A-Za-z'\-]{1,24})\b", re.IGNORECASE),
]

# Pass 1b: self-introduction patterns - the speaker naming themselves.
_SELF_INTRO_PATTERNS = [
    re.compile(r"\bmy name is\s+([A-Za-z][A-Za-z'\-]{1,24})\b", re.IGNORECASE),
    re.compile(r"\bmy name'?s\s+([A-Za-z][A-Za-z'\-]{1,24})\b", re.IGNORECASE),
    re.compile(r"\bthis is\s+([A-Za-z][A-Za-z'\-]{1,24})\s+(?:here|speaking)\b", re.IGNORECASE),
    re.compile(r"\bi'?m\s+([A-Za-z][A-Za-z'\-]{1,24})\b(?!\s+(?:fine|good|great|okay|ok|sorry|not|going|trying|here|ready|done|sure))", re.IGNORECASE),
    re.compile(r"\bi am\s+([A-Za-z][A-Za-z'\-]{1,24})\b(?!\s+(?:fine|good|great|okay|ok|sorry|not|going|trying|here|ready|done|sure))", re.IGNORECASE),
]


def _title_case_name(word: str) -> str:
    """Title-case each hyphen/apostrophe-separated part ("anne-marie" ->
    "Anne-Marie", "d'souza" -> "D'Souza") rather than a flat str.title()/
    capitalize(), which would mangle the letter right after the delimiter."""
    parts = re.split(r"([\-'])", word)
    out = []
    for part in parts:
        if part in ("-", "'"):
            out.append(part)
        elif part:
            out.append(part[0].upper() + part[1:].lower())
    return "".join(out)


def _clean_candidate(raw: str) -> Optional[str]:
    """Normalize a captured token into a display-ready name, or None if it's
    clearly not a name (stopword / role label / too short)."""
    word = (raw or "").strip().strip("'-")
    if not word or len(word) < 2:
        return None
    if word.lower() in _STOPWORDS or word.lower() in _ROLE_LABELS:
        return None
    # We don't trust Deepgram's capitalization as a signal (uncommon names
    # are exactly the ones likely to come back lowercase), so we normalize
    # our own display casing instead of preserving whatever it produced.
    return _title_case_name(word)


def _regex_candidates(segments: List[Dict[str, Any]]) -> List[Tuple[str, float]]:
    """Returns [(name, start_time), ...] found via cue patterns, in the
    order they occur. start_time is used later to prefer earlier mentions
    (introductions cluster at the start of a call)."""
    hits: List[Tuple[str, float]] = []
    for seg in segments:
        text = (seg.get("text") or "")
        speaker = (seg.get("speaker") or "").strip().lower()
        start = float(seg.get("start") or 0.0)

        if speaker == "tutor":
            for pat in _VOCATIVE_PATTERNS:
                for m in pat.finditer(text):
                    name = _clean_candidate(m.group(1))
                    if name:
                        hits.append((name, start))

        if speaker == "student":
            for pat in _SELF_INTRO_PATTERNS:
                for m in pat.finditer(text):
                    name = _clean_candidate(m.group(1))
                    if name:
                        hits.append((name, start))
    return hits


_SPACY_MODEL = None
_SPACY_LOAD_ATTEMPTED = False


def _get_spacy_model():
    """Lazily load spaCy's small English model. Cached across calls within
    the same process. Returns None (and logs once) if spacy or the model
    isn't installed - this fallback is optional, never fatal."""
    global _SPACY_MODEL, _SPACY_LOAD_ATTEMPTED
    if _SPACY_LOAD_ATTEMPTED:
        return _SPACY_MODEL
    _SPACY_LOAD_ATTEMPTED = True
    try:
        import spacy
        _SPACY_MODEL = spacy.load("en_core_web_sm", disable=["lemmatizer", "tagger", "attribute_ruler"])
        log_with_type("info", "name_detector: spaCy en_core_web_sm loaded for NER fallback", "PYTHON_DEEPGRAM")
    except Exception as exc:
        log_with_type(
            "warning",
            f"name_detector: spaCy NER fallback unavailable ({type(exc).__name__}: {exc}) - "
            "install with `pip install spacy` + `python -m spacy download en_core_web_sm` "
            "to enable it. Continuing without it.",
            "PYTHON_DEEPGRAM",
        )
        _SPACY_MODEL = None
    return _SPACY_MODEL


def _spacy_candidates(segments: List[Dict[str, Any]]) -> List[Tuple[str, float]]:
    """Returns [(name, start_time), ...] found via PERSON-entity recognition
    over the whole transcript. Used only when the regex pass finds nothing."""
    nlp = _get_spacy_model()
    if nlp is None:
        return []

    hits: List[Tuple[str, float]] = []
    for seg in segments:
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        start = float(seg.get("start") or 0.0)
        doc = nlp(text)
        for ent in doc.ents:
            if ent.label_ != "PERSON":
                continue
            # A PERSON entity can span multiple tokens ("Neeraj Tanwar") -
            # keep just the first token as the display/first name, consistent
            # with the regex pass, and run it through the same cleanup.
            first_token = ent.text.split()[0] if ent.text.split() else ent.text
            name = _clean_candidate(first_token)
            if name:
                hits.append((name, start))
    return hits


def detect_student_name(segments: List[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    """Main entry point. Pass the role-labelled segments (after
    transcriber._apply_role_labels has run, so speaker is "Tutor"/"Student").

    Returns {"student_name": str|None, "confidence": str|None, "source": str|None}.
    Never raises - any internal failure degrades to "not detected" so it
    can't break the transcription pipeline it's bolted onto.
    """
    empty = {"student_name": None, "confidence": None, "source": None}
    try:
        if not segments:
            return empty

        regex_hits = _regex_candidates(segments)
        if regex_hits:
            counts = Counter(name for name, _ in regex_hits)
            best_name, best_count = counts.most_common(1)[0]
            # Agreement between multiple mentions (or multiple distinct cue
            # types) is a stronger signal than a single hit.
            confidence = "high" if best_count > 1 or len(counts) == 1 else "high"
            log_with_type(
                "info",
                f"name_detector: student_name='{best_name}' via regex_cue "
                f"(candidates={dict(counts)})",
                "PYTHON_DEEPGRAM",
            )
            return {"student_name": best_name, "confidence": confidence, "source": "regex_cue"}

        spacy_hits = _spacy_candidates(segments)
        if spacy_hits:
            counts = Counter(name for name, _ in spacy_hits)
            # Prefer the most frequent candidate; break ties by earliest mention.
            earliest = {name: min(t for n, t in spacy_hits if n == name) for name in counts}
            best_name = sorted(counts.keys(), key=lambda n: (-counts[n], earliest[n]))[0]
            confidence = "medium" if counts[best_name] > 1 else "low"
            log_with_type(
                "info",
                f"name_detector: student_name='{best_name}' via spacy_ner "
                f"(candidates={dict(counts)})",
                "PYTHON_DEEPGRAM",
            )
            return {"student_name": best_name, "confidence": confidence, "source": "spacy_ner"}

        log_with_type("info", "name_detector: no student name detected", "PYTHON_DEEPGRAM")
        return empty
    except Exception as exc:
        log_with_type("error", f"name_detector: detection failed ({type(exc).__name__}: {exc}) - continuing without it", "PYTHON_DEEPGRAM")
        return empty
