/**
 * Calendar Helper
 * Shared utility functions for calendar operations
 * Consolidates duplicate helper functions from routes and controllers
 */

const { URL } = require('url');

class CalendarHelper {
  /**
   * Extract meeting link from event description
   * @param {string} text - Event description text
   * @param {string} location - Event location
   * @returns {string|null} - Meeting URL or null
   */
  static extractMeetingLink(text = '', location = '') {
    if (!text) return null;
    const matches = text.match(/https?:\/\/[^\s<>\]]+/g);
    if (!matches) return null;

    for (let url of matches) {
      url = url.replace(/[>\])"']+$/, '');
      if (
        url.includes('zoom.us') ||
        url.includes('teams.microsoft.com') ||
        url.includes('teams.live.com') ||
        url.includes('meet.google.com') ||
        url.includes('webex.com') ||
        url.includes('gotomeeting.com')
      ) {
        return url;
      }
    }
    return null;
  }

  /**
   * Detect platform from meeting link or location
   * @param {string} link - Meeting URL
   * @param {string} location - Event location
   * @returns {string} - Platform: zoom, google-meet, teams, unknown
   */
  static detectPlatform(link = '', location = '') {
    if (!link && !location) return 'unknown';

    if (location) {
      const lowerLoc = location.toLowerCase().trim();
      if (lowerLoc === 'zoom' || lowerLoc.includes('zoom.us')) return 'zoom';
      if (lowerLoc.includes('google meet') || lowerLoc.includes('meet.google')) return 'google-meet';
      if (lowerLoc.includes('teams')) return 'teams';
    }

    if (link) {
      const lowerLink = link.toLowerCase();
      if (lowerLink.includes('meet.google.com')) return 'google-meet';
      if (lowerLink.includes('zoom.us')) return 'zoom';
      if (lowerLink.includes('teams.microsoft.com') || lowerLink.includes('teams.live.com')) return 'teams';
    }

    return 'unknown';
  }

  /**
   * Extract meeting ID and passcode from platform-specific links
   * @param {string} link - Meeting URL
   * @param {string} platform - Platform name
   * @param {string} description - Event description
   * @param {string} location - Event location
   * @returns {Object} - { meetingId, passcode }
   */
  static extractMeetingId(link, platform, description = '', location = '') {
    let meetingId = null;
    let passcode = null;

    // -------- Zoom --------
    if (platform === 'zoom') {
      try {
        if (link) {
          const url = new URL(link);
          const match = url.pathname.match(/\/j\/(\d+)/);
          if (match) meetingId = match[1];
        }
      } catch {}

      if (description) {
        const idMatch = description.match(/Meeting ID[:\s]*([\d\s]+)/i);
        if (idMatch) {
          meetingId = idMatch[1].replace(/\s/g, '');
        }

        const passMatch = description.match(/(?:Passcode|Password)[:\s]*([\w]+)/i);
        if (passMatch) {
          passcode = passMatch[1];
        }
      }

      return { meetingId, passcode };
    }

    // -------- Teams --------
    if (platform === 'teams') {
      if (!link) return { meetingId: null, passcode: null };

      let passcode = null;
      const passMatch = description.match(/(?:Passcode|Password)[:\s]*([\w]+)/i) || link.match(/[?&](?:passcode|pwd|p)=([^&]+)/i);
      if (passMatch) passcode = passMatch[1];

      const orgMatch = link.match(/meetup-join\/([^/?]+)/);
      if (orgMatch) {
        const decoded = decodeURIComponent(orgMatch[1]);
        const meetingMatch = decoded.match(/(meeting_[^@]+)/);
        return {
          meetingId: meetingMatch ? meetingMatch[1] : decoded,
          passcode
        };
      }

      const liveMatch = link.match(/meet\/(\d+)/);
      if (liveMatch) {
        return {
          meetingId: liveMatch[1],
          passcode
        };
      }

      return {
        meetingId: 'teams-' + Date.now(),
        passcode
      };
    }

    // -------- Google Meet --------
    if (platform === 'google-meet') {
      const meetUrl = location || link;
      if (!meetUrl) {
        return { meetingId: null, passcode: null };
      }

      try {
        const url = new URL(meetUrl);
        const meetingId = url.pathname.replace('/', '');
        return {
          meetingId: meetingId || null,
          passcode: null
        };
      } catch {
        return { meetingId: null, passcode: null };
      }
    }

    return { meetingId: null, passcode: null };
  }

  /**
   * Store meeting from calendar event into database
   */
  static async storeMeetingFromEvent(e, email, platformType, link) {
    const meetingId = null;
    const { meetingId: extractedId, passcode } = CalendarHelper.extractMeetingId(
      link, platformType, e.description || '', e.location || ''
    );

    if (extractedId && extractedId !== 'unknown' && extractedId !== 'null') {
      const MeetingModel = require('../models/meetings/MeetingModel');
      await MeetingModel.getMeetingByIdOrCreate({
        meetingId: extractedId,
        platform: platformType,
        eventId: e.id,
        passcode: passcode,
        account: email,
        meetingLink: link,
        startTime: e.start.dateTime || e.start.date,
        endTime: e.end.dateTime || e.end.date,
        timezone: e.start.timezone,
        title: e.summary || 'Untitled Meeting'
      });
      return true;
    }
    return false;
  }
}

module.exports = CalendarHelper;