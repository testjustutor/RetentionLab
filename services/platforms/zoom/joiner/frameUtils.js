// frameUtils.js

module.exports.getZoomFrame = async function getZoomFrame() {

  const zoomFrames = this.page.frames()
    .filter(f => /zoom\.us|zoom\.com/.test(f.url()));

  const wcFrame = zoomFrames.find(f =>
    /\/wc\//.test(f.url()) || f.url().includes('/meeting')
  );

  if (wcFrame) return wcFrame;

  if (zoomFrames.length > 0) {
    return zoomFrames[0];
  }

  const frameHandle = await this.page.$(
    'iframe#webclient, iframe[src*="zoom.us"], iframe[src*="zoom.com"], iframe[src*="us04web.zoom.us"]'
  );

  if (frameHandle) {

    const childFrame = await frameHandle.contentFrame();

    if (childFrame) {
      return childFrame;
    }
  }

  return this.page.mainFrame
    ? this.page.mainFrame()
    : this.page;
};

module.exports.findTranscriptInAnyFrame = async function findTranscriptInAnyFrame() {

  const frames = this.page.frames();

  for (const candidate of frames) {

    const found = await candidate.evaluate(() => {

      const selectors = [
        '.transcript-item-area',
        '.zm-transcript-viewer',
        '.zm-sidebar-pane',
        '.cc-transcript-text',
        '.cc-transcript-list',
        '[class*="transcript"]',
        '[id*="transcript"]',
        '[aria-label*="Transcript"]',
        '[aria-label*="Captions"]'
      ];

      if (selectors.some(sel => document.querySelector(sel))) {
        return true;
      }

      const visibleText = Array.from(
        document.querySelectorAll('span, div, h1, h2, p, li')
      ).find(el =>
        el.innerText &&
        /Transcript|Caption|Live Transcript|Closed Caption/i.test(el.innerText) &&
        el.offsetParent !== null
      );

      return !!visibleText;

    }).catch(() => false);

    if (found) {
      return true;
    }
  }

  return false;
};