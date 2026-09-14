/**
 * services/shared/transcriptValidator.js
 *
 * Lightweight Node-side mirror of services/engine/transcript_validation.py's
 * "is this transcript worth keeping" check, for the ONE part of the video
 * pipeline that never touches the Python engine at all: the Deepgram
 * "AI Transcript" endpoint (videoProcessingController.js::generateTranscript()).
 * That endpoint has no Whisper/audit run to hang a Python-side check off of,
 * so it needs its own minimal check to avoid persisting a blank/meaningless
 * transcript file.
 *
 * This is intentionally NOT a full port of transcript_validation.py's
 * single-speaker detection (that check exists to protect the AI audit LLM
 * call, which the Deepgram endpoint never makes) - just the shared
 * "meaningful word count" definition, kept in one place and configurable
 * from the SAME env var (TRANSCRIPT_MIN_MEANINGFUL_WORDS) so both languages
 * agree on what "empty" means.
 */

const MIN_MEANINGFUL_WORDS = parseInt(process.env.TRANSCRIPT_MIN_MEANINGFUL_WORDS, 10) || 10;

// Same TRANS_*.txt banner/header/footer boilerplate pattern as
// services/engine/transcript_validation.py - kept in lockstep so a
// caption/content line is judged the same way regardless of which language
// happens to see it first.
const BOILERPLATE_LINE_RE = /^\s*(=+|[A-Z][A-Z\- ]*MEETING TRANSCRIPT|Meeting ID\s*:|Session ID\s*:|Date\s*:|TRANSCRIPT ENDED\s*:).*$/gm;

// Generic "[...] Name:" caption-line pattern - matches Teams/Zoom's single-
// timestamp format AND Google Meet/Deepgram's time-range format without
// hardcoding either shape (see services/engine/transcript_validation.py for
// the full rationale / real-format investigation notes).
const CAPTION_LINE_RE = /^\s*\[[^\]\n]*\]\s*([^:\n]+?)\s*:/gm;

function stripBoilerplate(text) {
  if (!text) return '';
  const cleaned = String(text).replace(BOILERPLATE_LINE_RE, '');
  return cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join('\n');
}

function meaningfulWordCount(text) {
  const cleaned = stripBoilerplate(text);
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

/** Best-effort distinct-speaker count from a "[...] Name:" style transcript. */
function detectSpeakerCount(captionsText) {
  if (!captionsText) return 0;
  const names = new Set();
  let match;
  CAPTION_LINE_RE.lastIndex = 0;
  while ((match = CAPTION_LINE_RE.exec(captionsText)) !== null) {
    const name = match[1].trim();
    if (name) names.add(name.toLowerCase());
  }
  return names.size;
}

/**
 * Decide whether a transcript has enough real content to be worth keeping.
 * @param {string} transcriptText - the transcript that would be saved/shown.
 * @returns {{valid: true} | {valid: false, reason: 'empty_transcript', message: string}}
 */
function validateTranscript(transcriptText) {
  const wordCount = meaningfulWordCount(transcriptText);

  if (wordCount < MIN_MEANINGFUL_WORDS) {
    return {
      valid: false,
      reason: 'empty_transcript',
      message: 'No meaningful speech was detected in this recording, so no transcript was saved.'
    };
  }

  return { valid: true };
}

module.exports = {
  MIN_MEANINGFUL_WORDS,
  stripBoilerplate,
  meaningfulWordCount,
  detectSpeakerCount,
  validateTranscript
};
