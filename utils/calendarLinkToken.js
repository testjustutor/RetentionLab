const jwt = require('jsonwebtoken');

const CALENDAR_LINK_SECRET = process.env.CALENDAR_LINK_SECRET || process.env.JWT_SECRET || 'calendar_link_secret_change_me';
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
