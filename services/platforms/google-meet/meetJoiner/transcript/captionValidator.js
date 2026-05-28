/**
 * root/services/platforms/google-meet/meetJoiner/transcript/captionValidator.js
 */

const INVALID_PATTERNS = [
  /camera not found/i,
  /microphone not found/i,
  /make sure your camera is plugged in/i,
  /try again/i,
  /raise hand/i,
  /you are muted/i,
  /you have joined the call/i,
  /your camera is off/i,
  /your microphone is off/i,
  /no one else is in the call/i,
  // Fix 3: Add UI artifact patterns
  /turn on captions/i,
  /captions are off/i,
  /present now/i,
  /pin to screen/i,
  /more options/i,
  /remove from call/i,
  /message sent/i,
  /\breaction\b/i,
  /^[\s\W]+$/,               // only symbols/spaces
];

// Fix 3: Also reject text that is ONLY a proper name (2-4 words, all capitalized first letters)
// These are likely name bubbles leaking into captions
const NAME_BUBBLE_PATTERN = /^([A-Z][a-z]+ ){1,3}[A-Z][a-z]+$/;

function isValid(text) {
  if (!text || text.trim().length < 2) return false;
  if (NAME_BUBBLE_PATTERN.test(text.trim())) return false;
  return !INVALID_PATTERNS.some(p => p.test(text));
}

module.exports = { INVALID_PATTERNS, isValid };