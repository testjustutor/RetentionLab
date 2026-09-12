/**
 * services/featureConfig.js
 *
 * Single place to toggle bot features on/off. Restart the bot process after
 * changing a value.
 *
 * media/attendanceMonitor/participantTracker: google-meet only, both bot
 * paths (GoogleMeetAdapter.js and socraticbot.js).
 * captionMonitor: google-meet only, Path A (GoogleMeetAdapter.js) only -
 * Path B (socraticbot.js) still runs captions unconditionally.
 * audioRecorder/screenRecorder: ALL platforms (google-meet/zoom/teams), both
 * paths - whole-machine ffmpeg capture, so never run two bots recording at
 * once on the same machine.
 */
module.exports = {
  // Mic/camera enforcement on join.
  media: {
    muteMicOnJoin: true,
    disableCameraOnJoin: true,
  },

  // Join/leave/rejoin attendance tracking + "bot alone" exit check.
  attendanceMonitor: {
    enabled: true,
  },

  // DB persistence for who's in the meeting (feeds attendanceMonitor).
  participantTracker: {
    enabled: true,
  },

  // Live captions + transcript file. Path A only (see header).
  captionMonitor: {
    enabled: true,
  },

  // System-audio capture via ffmpeg. All platforms, both paths.
  audioRecorder: {
    enabled: true,
  },

  // Screen capture via ffmpeg. All platforms, both paths.
  screenRecorder: {
    enabled: false,
  },
};
