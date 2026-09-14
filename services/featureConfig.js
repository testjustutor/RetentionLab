/**
 * services/featureConfig.js
 *
 * Single place to toggle bot features on/off, per platform. Restart the bot
 * process after changing a value.
 *
 * Each platform (google-meet / zoom / teams) below is a fully independent
 * copy of every toggle - flipping something for one platform has no effect
 * on the others.
 *
 * google-meet's copy applies to BOTH of its bot paths: the standalone
 * GoogleMeetAdapter.js (Path A) and the shared SocraticBot orchestrator in
 * socraticbot.js (Path B) - which is also the orchestrator zoom and teams
 * run through. Previously media/attendanceMonitor/participantTracker/
 * captionMonitor were only actually wired up in GoogleMeetAdapter.js (Path
 * A never read anything for zoom/teams, and Path B didn't check this file
 * for these four at all despite the old header comment claiming otherwise);
 * all four are now read from here for every platform, on whichever path
 * runs it.
 *
 * audioRecorder/screenRecorder: whole-machine ffmpeg capture - never run
 * two bots recording at once on the same machine, regardless of platform.
 */
module.exports = {
  zoom: {
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

    // Live captions + transcript file.
    captionMonitor: {
      enabled: true,
    },

    // System-audio capture via ffmpeg.
    audioRecorder: {
      enabled: true,
    },

    // Screen capture via ffmpeg.
    screenRecorder: {
      enabled: false,
    },
  },

  teams: {
    media: {
      muteMicOnJoin: true,
      disableCameraOnJoin: true,
    },

    attendanceMonitor: {
      enabled: true,
    },

    participantTracker: {
      enabled: true,
    },

    captionMonitor: {
      enabled: true,
    },

    audioRecorder: {
      enabled: true,
    },

    screenRecorder: {
      enabled: false,
    },
  },

  'google-meet': {
    media: {
      muteMicOnJoin: true,
      disableCameraOnJoin: true,
    },

    attendanceMonitor: {
      enabled: true,
    },

    participantTracker: {
      enabled: true,
    },

    captionMonitor: {
      enabled: true,
    },

    audioRecorder: {
      enabled: true,
    },

    screenRecorder: {
      enabled: false,
    },
  },
};
