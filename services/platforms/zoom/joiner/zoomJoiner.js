const joinMeeting = require('./joinMeeting');
const { preparePreJoinMedia, ensureMicMuted } = require('./mediaControls');
const { getZoomFrame, findTranscriptInAnyFrame } = require('./frameUtils');
const CaptionsManager = require('./captionsManager');
const TranscriptActivation = require('./transcriptActivation');
const PopupHandler = require('./popupHandler');

class ZoomJoiner {
  constructor(page, botName, passcode, meetingUrl) {
    this.page = page;
    this.botName = botName;
    this.passcode = passcode;
    this.meetingUrl = meetingUrl;
    this.participantTracker = null;

    this.captionsManager = new CaptionsManager(
      page,
      this.getZoomFrame.bind(this)
    );

    this.transcriptActivation = new TranscriptActivation(
      page,
      this.getZoomFrame.bind(this),
      findTranscriptInAnyFrame.bind(this)
    );

    this.popupHandler = new PopupHandler(page);
  }

  setParticipantTracker(tracker) {
    this.participantTracker = tracker;
  }
}

ZoomJoiner.prototype.joinMeeting = joinMeeting;

ZoomJoiner.prototype.preparePreJoinMedia = preparePreJoinMedia;
ZoomJoiner.prototype.ensureMicMuted = ensureMicMuted;

ZoomJoiner.prototype.getZoomFrame = getZoomFrame;
ZoomJoiner.prototype.findTranscriptInAnyFrame = findTranscriptInAnyFrame;

ZoomJoiner.prototype.sendChatRequest = function() {
  return this.captionsManager.sendChatRequest(this.botName);
};

ZoomJoiner.prototype.checkCaptionsEnabled = function() {
  return this.captionsManager.checkCaptionsEnabled();
};

ZoomJoiner.prototype.startTranscriptMonitor = function(captionMonitor) {
  return this.transcriptActivation.startTranscriptMonitor(captionMonitor);
};

ZoomJoiner.prototype.verifySidebarVisibility = function(frame) {
  return this.transcriptActivation.verifySidebarVisibility(frame);
};

ZoomJoiner.prototype.executeNavigationSequence = function(frame) {
  return this.transcriptActivation.executeNavigationSequence(frame);
};

ZoomJoiner.prototype.handleHostPermissionPopup = function(frame) {
  return this.popupHandler.handleHostPermissionPopup(frame);
};

module.exports = ZoomJoiner;