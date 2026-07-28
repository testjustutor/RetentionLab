/**
 * Calendar Sync Service
 * Syncs meetings from Google Calendar to local database
 */

const { google } = require('googleapis');
const CalendarUsersModel = require('../models/calendar/CalendarUsersModel');
const MeetingsModel = require('../models/meetings/MeetingModel');
const { logger } = require('../utils/logger');

/**
 * Sync meetings from Google Calendar to local database
 * @param {string} userEmail - User's email
 * @param {number} userId - User's ID
 * @param {number} daysBack - How many days back to fetch (default: 30)
 * @param {number} daysForward - How many days forward to fetch (default: 90)
 */
async function syncGoogleCalendar(userEmail, userId, daysBack = 30, daysForward = 90) {
  try {
    // Get stored calendar credentials using user_id (not email)
    const calendarUser = await CalendarUsersModel.getUser(userId);
    if (!calendarUser || !calendarUser.access_token) {
      logger.info(`[CalendarSync] No calendar connection for user ${userId}`);
      return { synced: 0, message: 'Calendar not connected' };
    }

    // Calculate time range
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - daysBack);
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + daysForward);

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: calendarUser.access_token,
      refresh_token: calendarUser.refresh_token,
      expiry_date: calendarUser.expiry_date
    });

    // Check if token needs refresh
    if (calendarUser.token_expiry && new Date(calendarUser.token_expiry).getTime() < Date.now()) {
      logger.info(`[CalendarSync] Refreshing token for user ${userId}`);
      const { token } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(token);
      
      // Save new tokens using user_id
      await CalendarUsersModel.createOrUpdateUser(userId, {
        access_token: token.access_token,
        refresh_token: token.refresh_token || calendarUser.refresh_token,
        expiry_date: token.expiry_date,
        provider: 'google',
        provider_id: calendarUser.provider_id // Preserve existing provider_id
      });
    }

    // Fetch events from Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100
    });

    const events = response.data.items || [];
    logger.info(`[CalendarSync] Found ${events.length} events for user ${userId}`);


    // Sync each event to local database
    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const event of events) {
      try {
        const eventId = event.id || 'unknown';
        const eventTitle = event.summary || 'Untitled';
        
        // Skip events without start/end times
        if (!event.start?.dateTime || !event.end?.dateTime) {
          logger.info(`[CalendarSync] Skipping event ${eventId} (${eventTitle}): no start/end times`);
          skipped++;
          continue;
        }

        // Skip all-day events
        if (!event.start.dateTime.includes('T')) {
          logger.info(`[CalendarSync] Skipping event ${eventId} (${eventTitle}): all-day event`);
          skipped++;
          continue;
        }

        // Check if meeting already exists (by title + time + owner)
        const existingMeeting = await MeetingsModel.findMeetingByTitleAndTime(eventTitle, event.start.dateTime, userId);

        if (existingMeeting) {
          // Update existing meeting using model method
          await MeetingsModel.updateMeetingFromCalendar(
            existingMeeting.meeting_id,
            eventTitle,
            'Google Calendar',
            event.start.dateTime,
            event.end.dateTime
          );
        } else {
          // Create new meeting using model method
          await MeetingsModel.createMeetingFromCalendar(
            eventTitle,
            'Google Calendar',
            event.start.dateTime,
            event.end.dateTime,
            userId
          );
        }

        synced++;
      } catch (err) {
        failed++;
        logger.error(`[CalendarSync] Error syncing event ${event.id} (${eventTitle}):`, err);
      }
    }

    logger.info(`[CalendarSync] Completed for ${userEmail}: synced=${synced}, skipped=${skipped}, failed=${failed}, total=${events.length}`);
    return { synced, skipped, failed, total: events.length };

  } catch (err) {
    logger.error(`[CalendarSync] Error syncing calendar for ${userEmail}:`, err);
    throw err;
  }
}

module.exports = {
  syncGoogleCalendar
};