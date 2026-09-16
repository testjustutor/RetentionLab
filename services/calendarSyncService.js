/**
 * services/calendarSyncService.js
 * Calendar Sync Service
 * Syncs meetings from Google Calendar / Microsoft Calendar to local database
 *
 * ─────────────────────────────────────────────────────────────
 * PROCESS FLOW (syncGoogleCalendar)
 *   User has Google Calendar connected
 *      │
 *      ▼
 *   1. Get user's saved Google OAuth tokens
 *   2. Check/refresh expired token
 *   3. Ask Google Calendar for events
 *   4. Loop through events
 *   5. Ignore invalid/all-day events
 *   6. Create/update local meeting  ──► meetings table
 * ─────────────────────────────────────────────────────────────
 * syncMicrosoftCalendar() below follows the exact same 6 steps against
 * Microsoft Graph instead of the Google Calendar API — see
 * controllers/calendar/MicrosoftCalendarEventController.js for the shared
 * token-refresh logic this mirrors.
 * ─────────────────────────────────────────────────────────────
 */

const { google } = require('googleapis');
const axios = require('axios');
const MeetingsController = require('../controllers/meetings/meetingsController');
const CalendarUsersModel = require('../models/calendar/CalendarUsersModel');
const MicrosoftCalendarAuthModel = require('../models/calendar/MicrosoftCalendarAuthModel');
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
    // =========================================================
    // STEP 1 — Get user's saved Google OAuth tokens
    // Fetch the stored Google Calendar credentials for this user.
    // =========================================================
    const calendarUser = await MeetingsController.getCalendarUser(userId);
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

    // =========================================================
    // STEP 2 — Check/refresh expired token
    // If the access token has expired, refresh it via Google and
    // persist the new tokens so future syncs stay authorized.
    // =========================================================
    // Check if token needs refresh (timestamp comparison is reliable)
    if (calendarUser.token_expires_at && new Date(calendarUser.token_expires_at).getTime() < Date.now()) {
      logger.info(`[CalendarSync] Refreshing token for user ${userId}`);
      const { token } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(token);
      
      // Save new tokens using user_id
      await MeetingsController.saveCalendarUserTokens(userId, {
        access_token: token.access_token,
        refresh_token: token.refresh_token || calendarUser.refresh_token,
        expiry_date: token.expiry_date,
        provider: 'google',
        provider_id: calendarUser.provider_id // Preserve existing provider_id
      });
    }

    // =========================================================
    // STEP 3 — Ask Google Calendar for events
    // Request the user's upcoming events over the configured
    // time window (daysBack → daysForward).
    // =========================================================
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

    // =========================================================
    // STEP 4 — Loop through events
    // Process every Google Calendar event one at a time.
    // =========================================================
    for (const event of events) {
      try {
        const eventId = event.id || 'unknown';
        const eventTitle = event.summary || 'Untitled';
        
        // -----------------------------------------------
        // STEP 5 — Ignore invalid/all-day events
        // -----------------------------------------------
        // Skip events that have no start/end times
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

        // -------------------------------------------------
        // STEP 6 — Create/update local meeting
        // Ensure the event exists in the meetings table
        // (dedup by title + start time + owner): update the
        // existing row or create a new one.
        // -------------------------------------------------
        await MeetingsController.syncMeetingFromCalendar({
          title: eventTitle,
          platform: 'Google Calendar',
          startTime: event.start.dateTime,
          endTime: event.end.dateTime,
          userId,
          calendarAccount: userEmail
        });

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

/**
 * Sync meetings from Microsoft (Outlook/Teams) Calendar to local database.
 * Mirrors syncGoogleCalendar() above step-for-step, against Microsoft Graph.
 * @param {string} userEmail - User's email
 * @param {number} userId - User's ID
 * @param {number} daysBack - How many days back to fetch (default: 30)
 * @param {number} daysForward - How many days forward to fetch (default: 90)
 */
async function syncMicrosoftCalendar(userEmail, userId, daysBack = 30, daysForward = 90) {
  try {
    // =========================================================
    // STEP 1 — Get user's saved Microsoft OAuth tokens
    // Scoped to the 'teams' provider so this never picks up the same
    // user's Google connection row by accident.
    // =========================================================
    const calendarUser = await CalendarUsersModel.getUserByProviderName(userId, MicrosoftCalendarAuthModel.PROVIDER_NAME);
    if (!calendarUser || !calendarUser.access_token) {
      logger.info(`[CalendarSync] No Microsoft calendar connection for user ${userId}`);
      return { synced: 0, message: 'Calendar not connected' };
    }

    // Calculate time range
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - daysBack);
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + daysForward);

    // =========================================================
    // STEP 2 — Check/refresh expired token
    // =========================================================
    let accessToken = calendarUser.access_token;
    if (calendarUser.token_expires_at && new Date(calendarUser.token_expires_at).getTime() < Date.now()) {
      logger.info(`[CalendarSync] Refreshing Microsoft token for user ${userId}`);
      const config = await MicrosoftCalendarAuthModel.getOAuthConfig();
      const body = new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        grant_type: 'refresh_token',
        refresh_token: calendarUser.refresh_token,
        scope: (config.scopes || []).join(' ')
      });
      const { data } = await axios.post(config.token_uri, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      accessToken = data.access_token;
      const newExpiry = Date.now() + (Number(data.expires_in || 3600) * 1000);

      // Save new tokens using user_id (provider_id preserved)
      await MeetingsController.saveCalendarUserTokens(userId, {
        access_token: accessToken,
        refresh_token: data.refresh_token || calendarUser.refresh_token,
        expiry_date: newExpiry,
        provider: MicrosoftCalendarAuthModel.PROVIDER_NAME,
        provider_id: calendarUser.provider_id
      });
    }

    // =========================================================
    // STEP 3 — Ask Microsoft Graph for events
    // =========================================================
    const config = await MicrosoftCalendarAuthModel.getOAuthConfig();
    const { data: eventsResponse } = await axios.get(`${config.graph_base_url}/me/calendarview`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"'
      },
      params: {
        startDateTime: timeMin.toISOString(),
        endDateTime: timeMax.toISOString(),
        $orderby: 'start/dateTime',
        $top: 100
      }
    });

    const events = eventsResponse.value || [];
    logger.info(`[CalendarSync] Found ${events.length} Microsoft events for user ${userId}`);

    let synced = 0;
    let skipped = 0;
    let failed = 0;

    // =========================================================
    // STEP 4 — Loop through events
    // =========================================================
    for (const event of events) {
      const eventId = event.id || 'unknown';
      const eventTitle = event.subject || 'Untitled';
      try {
        // -----------------------------------------------
        // STEP 5 — Ignore invalid/all-day events
        // -----------------------------------------------
        if (!event.start?.dateTime || !event.end?.dateTime) {
          logger.info(`[CalendarSync] Skipping Microsoft event ${eventId} (${eventTitle}): no start/end times`);
          skipped++;
          continue;
        }

        if (event.isAllDay) {
          logger.info(`[CalendarSync] Skipping Microsoft event ${eventId} (${eventTitle}): all-day event`);
          skipped++;
          continue;
        }

        // -------------------------------------------------
        // STEP 6 — Create/update local meeting
        // -------------------------------------------------
        await MeetingsController.syncMeetingFromCalendar({
          title: eventTitle,
          platform: 'Microsoft Calendar',
          startTime: event.start.dateTime,
          endTime: event.end.dateTime,
          userId,
          calendarAccount: userEmail
        });

        synced++;
      } catch (err) {
        failed++;
        logger.error(`[CalendarSync] Error syncing Microsoft event ${eventId} (${eventTitle}):`, err);
      }
    }

    logger.info(`[CalendarSync] Microsoft sync completed for ${userEmail}: synced=${synced}, skipped=${skipped}, failed=${failed}, total=${events.length}`);
    return { synced, skipped, failed, total: events.length };

  } catch (err) {
    logger.error(`[CalendarSync] Error syncing Microsoft calendar for ${userEmail}:`, err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  syncGoogleCalendar,
  syncMicrosoftCalendar
};