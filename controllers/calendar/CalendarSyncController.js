/**
 * Calendar Sync Controller
 * Handles calendar event synchronization and meeting extraction
 */

const CalendarUsersModel = require('../../models/calendar/CalendarUsersModel');
const MeetingModel = require('../../models/meetings/MeetingModel');
const CalendarAuthModel = require('../../models/calendar/CalendarAuthModel');
const CalendarEventController = require('./CalendarEventController');
const CalendarHelper = require('../../utils/calendarHelper');
const { logger } = require('../../utils/logger');

class CalendarSyncController {
  /**
   * Sync calendar events for a single user
   */
  static async syncUserCalendar(user) {
    try {
      // Fetch next 24 hours
      const events = await CalendarEventController.getEvents(user.email, {
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 24 * 3600000).toISOString(),
        singleEvents: true,
        maxResults: 50
      });

      // Process and store events
      await CalendarEventController.processAndStoreEvents(user.email, events);

      logger.debug(`Sync complete for ${user.email}`);
      return { success: true, user: user.email, eventsProcessed: events.length };
    } catch (userErr) {
      logger.error(`Failed to sync for ${user.email}: ${userErr.message}`);
      return { success: false, user: user.email, error: userErr.message };
    }
  }

  /**
   * Global calendar sync - syncs all connected users' calendars
   * Only users with a connected calendar (refresh token available) are synced,
   * so the access token can always be refreshed and meeting sync stays active.
   */
  static async globalSync() {
    try {
      const users = await CalendarUsersModel.getConnectedUsers();
      logger.debug(`Global Sync: checking ${users.length} connected users (have refresh token)`);

      const results = [];
      for (const user of users) {
        const result = await CalendarSyncController.syncUserCalendar(user);
        results.push(result);
      }

      return { success: true, results, totalUsers: users.length };
    } catch (err) {
      logger.error('Global background sync error:', err);
      return { success: false, error: err.message };
    }
  }
}

module.exports = CalendarSyncController;