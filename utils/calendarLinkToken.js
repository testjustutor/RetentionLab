const jwt = require('jsonwebtoken');

// FIX: was `process.env.CALENDAR_LINK_SECRET || process.env.JWT_SECRET ||
// 'calendar_link_secret_change_me'` - same class of bug as JWT_SECRET's old
// hardcoded fallback. Now requires its own explicit value at startup rather
// than silently degrading to a guessable default.
const CALENDAR_LINK_SECRET = process.env.CALENDAR_LINK_SECRET;
if (!CALENDAR_LINK_SECRET) {
  throw new Error('CALENDAR_LINK_SECRET environment variable is required - refusing to start with an insecure default.');
}
// Not a secret, so a sensible default is safe here.
const CALENDAR_LINK_EXPIRES_IN = process.env.CALENDAR_LINK_EXPIRES_IN || '7d';

function signCalendarLink(data) {
  return jwt.sign(
    {
      ...data,
      purpose: 'calendar-events-link',
    },
    CALENDAR_LINK_SECRET,
    { expiresIn: CALENDAR_LINK_EXPIRES_IN }
  );
}

function verifyCalendarLink(token) {
  try {
    const payload = jwt.verify(token, CALENDAR_LINK_SECRET);
    if (payload?.purpose !== 'calendar-events-link') return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { signCalendarLink, verifyCalendarLink };
