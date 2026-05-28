/**
 * root/services/platforms/google-meet/meetJoiner/transcript/captionExtractor.js
 */
const { logger } = require('../../../../../utils/logger');

async function extractCaptions(page, knownParticipants = new Set()) {
  logger.info('GoogleMeetJoiner(captionExtractor): ENTER captionExtractor');
  if (!page) return [];

  return await page.evaluate((participantList) => {
    const results = [];
    const seen = new Set();

    // ─── STRATEGY 1: Structured DOM (most reliable) ───────────────────────
    // Google Meet renders speaker name and caption text in separate jsname nodes
    const speakerEls = document.querySelectorAll('[jsname="dsyhDe"]');
    const captionEls = document.querySelectorAll('[jsname="tgaKEf"]');

    if (speakerEls.length > 0 && captionEls.length > 0) {
      speakerEls.forEach((speakerEl, i) => {
        const name = speakerEl.innerText?.trim();
        const textEl = captionEls[i];
        const text = textEl?.innerText?.trim();

        if (!name || !text) return;

        // Skip if text is just another participant's name (UI bubble artifact)
        if (participantList.includes(text)) return;

        const key = `${name}:${text}`;
        if (seen.has(key)) return;
        seen.add(key);

        results.push({ name, text, timestamp: new Date().toISOString() });
      });

      // If structured extraction worked, return early — no need for fallback
      if (results.length > 0) return results;
    }

    // ─── STRATEGY 2: Fallback — parse combined elements ───────────────────
    const selectors = [
      '[aria-live="polite"]',
      '[role="log"]',
      '[class*="caption"]',
      '.caption-text',
      '[data-participant-id]'
    ];

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);

      elements.forEach(el => {
        const raw = el.innerText?.trim();
        if (!raw || raw.length < 2 || seen.has(raw)) return;
        seen.add(raw);

        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        let name = 'System/Unknown';
        let message = '';

        if (lines.length >= 2) {
          const firstLine = lines[0];

          const isLikelyName =
            firstLine.length < 60 &&
            /^[A-Za-z0-9\s._\-]+$/.test(firstLine) &&
            !firstLine.includes(':') &&
            !/^\d/.test(firstLine);

          if (isLikelyName) {
            name = firstLine;

            // Filter out lines that are just participant name bubbles
            const messageLines = lines.slice(1).filter(line => {
              const isNameBubble =
                participantList.includes(line) ||
                (
                  line.length < 40 &&
                  /^[A-Z][a-z]+ ([A-Z][a-z]+ ?){1,3}$/.test(line) // "Firstname Lastname" pattern
                );
              return !isNameBubble;
            });

            message = messageLines.join(' ');
          } else {
            message = lines.join(' ');
          }
        } else {
          // Single line — check if it's just a name bubble before accepting
          const line = lines[0];
          const isNameBubble =
            participantList.includes(line) ||
            /^[A-Z][a-z]+ ([A-Z][a-z]+ ?){1,3}$/.test(line);

          if (isNameBubble) return;
          message = line;
        }

        if (!message || message.trim().length === 0) return;

        results.push({
          name,
          text: message.trim(),
          timestamp: new Date().toISOString()
        });
      });

      if (results.length > 0) break; // Stop at first selector that yields results
    }

    return results;

  }, [...knownParticipants]); // Pass participants into browser context
}

module.exports = { extractCaptions };