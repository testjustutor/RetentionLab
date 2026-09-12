# services/engine/services/summary_worker.py

import re

# ==========================================================
# LOCAL EXTRACTIVE SUMMARIZER (spaCy - no LLM / API calls)
#
# The summary is derived entirely from the transcript with a
# frequency-based (Luhn-style) extractive algorithm. The spaCy
# pipeline is built once and cached at module level (same
# pattern as WhisperLoader) so each session pays a one-time cost.
# ==========================================================

SUMMARY_MIN_WORDS = 150
SUMMARY_MAX_WORDS = 250
SUMMARY_PREVIEW_WORDS = 120

# Platform transcript headers / separators / metadata lines that
# must never be treated as meeting content (Google Meet / Zoom /
# Teams captions files, generated AUDIO_TRANS files). Examples:
#   ==========================================
#   GOOGLE-MEET MEETING TRANSCRIPT
#   Meeting ID : 11
#   Session ID : 12
#   Date       : 9/11/2026, 6:59:06 PM
_HEADER_RE = re.compile(
    r"^(?:"
    r"[=\-_*]{3,}"                          # separator runs
    r"|GOOGLE[\s-]*MEET"                    # platform banner
    r"|ZOOM"
    r"|TEAMS"
    r"|MEETING\s+ID"
    r"|SESSION\s+ID"
    r"|DATE\s*:"
    r"|TRANSCRIPT\b"
    r")",
    re.IGNORECASE,
)

_NLP_CACHE = {}


def _get_nlp():
    """Build (once) a lightweight spaCy pipeline with a sentencizer."""
    nlp = _NLP_CACHE.get("nlp")
    if nlp is None:
        import spacy

        nlp = spacy.blank("en")
        nlp.add_pipe("sentencizer")
        _NLP_CACHE["nlp"] = nlp
    return nlp


def _is_noise(sentence_text):
    """True for empty / header / separator / punctuation-only lines."""
    text = sentence_text.strip()
    if not text:
        return True
    if not any(char.isalpha() for char in text):
        return True
    return bool(_HEADER_RE.match(text))


def _content_words(sentence):
    """Lowercased, stopword- and punctuation-free words of a sentence."""
    return [
        token.text.lower()
        for token in sentence
        if token.is_alpha and not token.is_stop and len(token.text) > 1
    ]


class SummaryWorker:

    def __init__(self):
        self.nlp = _get_nlp()

    # ==========================================
    # GENERATE
    # ==========================================

    def generate(self, transcript):

        transcript = (transcript or "").strip()

        if not transcript:
            return "Summary generation skipped: transcript is empty."

        try:
            return self._summarize(transcript)
        except Exception:
            # A summarizer failure must never break the pipeline.
            return self._preview(transcript)

    # ==========================================
    # FALLBACK (never fails - always returns text)
    # ==========================================

    @staticmethod
    def _preview(text):
        text = (text or "").strip()
        if not text:
            return "Summary generation skipped: transcript is empty."
        words = text.split()
        preview = " ".join(words[:SUMMARY_PREVIEW_WORDS])
        if len(words) > SUMMARY_PREVIEW_WORDS:
            preview += "..."
        return f"Meeting summary: {preview}"

    # ==========================================
    # EXTRACTIVE SUMMARY
    # ==========================================

    def _summarize(self, transcript):

        document = self.nlp(transcript)

        # Keep only real content sentences (drop headers/separators/fillers).
        content = [
            (sentence.text.strip(), _content_words(sentence))
            for sentence in document.sents
            if not _is_noise(sentence.text)
            and len(sentence.text.split()) >= 3
        ]
        content = [(text, words) for text, words in content if words]

        if not content:
            return "Summary generation skipped: transcript is empty."

        if len(content) < 2:
            return self._preview(" ".join(text for text, _ in content))

        # Word-frequency map over all content sentences.
        freq = {}
        for _, words in content:
            for word in words:
                freq[word] = freq.get(word, 0) + 1

        # Score each sentence: average term frequency + early-position bonus.
        total_sentences = len(content)
        scored = []
        for index, (text, words) in enumerate(content):
            score = sum(freq[word] for word in words) / len(words)
            position_bonus = (total_sentences - index) / total_sentences
            scored.append((score * (0.5 + 0.5 * position_bonus), index, len(text.split())))

        scored.sort(key=lambda item: item[0], reverse=True)

        # Greedily pick top sentences until the 150-250 word range is met.
        selected = []
        total_words = 0
        for _, index, word_count in scored:
            if word_count <= 0:
                continue
            # Stay inside [150, 250]; only exceed the upper bound when the
            # lower bound would otherwise be unreachable (short transcript).
            if total_words >= SUMMARY_MIN_WORDS and (
                total_words + word_count
            ) > SUMMARY_MAX_WORDS:
                break
            selected.append(index)
            total_words += word_count

        if len(selected) < 2:
            return self._preview(" ".join(text for text, _ in content))

        # Restore reading order so the summary reads as a narrative.
        paragraph = " ".join(
            content[index][0] for index in sorted(selected)
        ).strip()

        if not paragraph:
            return self._preview(" ".join(text for text, _ in content))

        return paragraph
