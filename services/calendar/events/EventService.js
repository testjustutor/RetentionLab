const { logger } = require('../../../utils/logger');

class EventService {
  constructor(calendar) {
    this.calendar = calendar;
  }

  async getEvents(options = {}) {
    try {
      const {
        calendarId = 'primary',
        maxResults = 10,
        timeMin,
        timeMax,
        singleEvents = true,
        orderBy = 'startTime'
      } = options;

      const queryOptions = {
        calendarId,
        maxResults,
        singleEvents,
        orderBy
      };

      if (timeMin) queryOptions.timeMin = new Date(timeMin).toISOString();
      if (timeMax) queryOptions.timeMax = new Date(timeMax).toISOString();

      const response = await this.calendar.events.list(queryOptions);
      return response.data.items || [];
    } catch (err) {
      logger.error('Error fetching calendar events:', err);
      throw err;
    }
  }

  async getEventById(calendarId, eventId) {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });

      return response.data;
    } catch (err) {
      logger.error('Error fetching event:', err);
      throw err;
    }
  }

  async getCalendars() {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (err) {
      logger.error('Error fetching calendars:', err);
      throw err;
    }
  }

  async createEvent(calendarId, event) {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        resource: event
      });

      logger.info('Event created:', response.data.id);
      return response.data;
    } catch (err) {
      logger.error('Error creating event:', err);
      throw err;
    }
  }

  async updateEvent(calendarId, eventId, event) {
    try {
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        resource: event
      });

      logger.info('Event updated:', eventId);
      return response.data;
    } catch (err) {
      logger.error('Error updating event:', err);
      throw err;
    }
  }
}

module.exports = EventService;
