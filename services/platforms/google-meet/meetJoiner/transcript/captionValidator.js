const INVALID_PATTERNS = [
  /camera not found/i,
  /microphone not found/i,
  /make sure your camera is plugged in/i,
  /try again/i,
  /raise hand/i,
  /present now/i,
  /controls/i,
  /you are muted/i,
  /you have joined the call/i,
  /your camera is off/i,
  /your microphone is off/i,
  /there (is|are) .* other person/i,
  /no one else is in the call/i
];

function isValid(text) {
  if (!text || text.trim().length < 2) {
    return false;
  }
  return !INVALID_PATTERNS.some(p => p.test(text));
}

module.exports = { INVALID_PATTERNS, isValid };