/**
 * root/services/calendar/config/EventService.js
 *
 */
const path = require('path');

const CREDENTIALS_DIR = path.join(__dirname, '../../../uploads/google-calendar-json');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

const CREDENTIALS_PATHS = [
  path.join(CREDENTIALS_DIR, 'credentials.json'),
  path.join(CREDENTIALS_DIR, 'credentials_1'),
  path.join(CREDENTIALS_DIR, 'credentials.json.json'),
  path.join(CREDENTIALS_DIR, 'credentials_test.json'),
  path.join(CREDENTIALS_DIR, 'credentials_2')
];

module.exports = { SCOPES, CREDENTIALS_PATHS, CREDENTIALS_DIR };

