/**
 * root/services/platforms/google-meet/meetJoiner/transcriptEngine.js
 *
 * Merged transcript engine: caption extraction, validation, processing,
 * participant event handling, storage, and real-time monitoring.
 */

'use strict';

const fs   = require('fs').promises;
const path = require('path');
const { logger } = require('../../../../utils/logger');

// ═══════════════════════════════════════════════════════════
// SECTION 1 — CAPTION VALIDATOR
// ═══════════════════════════════════════════════════════════

const INVALID_PATTERNS = [
  /camera not found/i,
  /microphone not found/i,
  /make sure your camera is plugged in/i,
  /try again/i,
  /raise hand/i,
  /you are muted/i,
  /you have joined the call/i,
  /your camera is off/i,
  /your microphone is off/i,
  /no one else is in the call/i,
  /turn on captions/i,
  /captions are off/i,
  /present now/i,
  /pin to screen/i,
  /more options/i,
  /remove from call/i,
  /message sent/i,
  /\breaction\b/i,
  /returning to home screen/i,
  /you are the only one/i,
  /meeting is being recorded/i,
  /^[\s\W]+$/,
];

const NAME_BUBBLE_PATTERN = /^([A-Z][a-z]+ ){1,3}[A-Z][a-z]+$/;

function isValid(text) {
  if (!text || text.trim().length < 2) return false;
  if (NAME_BUBBLE_PATTERN.test(text.trim())) return false;
  return !INVALID_PATTERNS.some(p => p.test(text));
}

// ═══════════════════════════════════════════════════════════
// SECTION 2 — CAPTION EXTRACTOR
// ═══════════════════════════════════════════════════════════

async function extractCaptions(page, knownParticipants = new Set()) {
  if (!page) return [];

  const captions = await page.evaluate((participantList) => {
    const results = [];
    const seen    = new Set();

    // ── Helper: Check if line is a participant name (not speech) ──
    function isNameBubble(line, list) {
      return (
        list.includes(line) ||
        (line.length < 40 && /^[A-Z][a-z]+ ([A-Z][a-z]+ ?){1,3}$/.test(line))
      );
    }

    // ── Strategy 1: Structural anchor using avatar image ──
    try {
      const region = document.querySelector('[role="region"][aria-label="Captions"]');
      if (region) {
        region.querySelectorAll(':scope > div > div').forEach(block => {
          const speakerRow = Array.from(block.querySelectorAll('div'))
            .find(d => d.querySelector('img'));
          if (!speakerRow) return;

          const name = speakerRow.querySelector('div > span')?.innerText?.trim();
          const text = speakerRow.nextElementSibling?.innerText?.trim();

          if (!name || !text || participantList.includes(text)) return;

          const key = `${name}:${text}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ name, text, strategy: 1, timestamp: new Date().toISOString() });
          }
        });

        if (results.length > 0) return results;
      }
    } catch (e) {
      return [{ __error: 'strategy1', message: e.message }];
    }

    // ── Strategy 2: Walk all speaker blocks by parsing caption region text ──
    try {
      const region = document.querySelector('[role="region"][aria-label="Captions"]');
      if (region) {
        const raw = region.innerText?.trim();
        if (raw && raw.length > 2) {
          const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

          let i = 0;
          while (i < lines.length) {
            const first = lines[i];
            const isLikelyName =
              first.length < 60 &&
              /^[A-Za-z0-9\s._\-]+$/.test(first) &&
              !first.includes(':') &&
              !/^\d/.test(first);

            if (isLikelyName && i + 1 < lines.length) {
              const name = first;
              const text = lines[i + 1];

              // Check if next line is also a name (no text yet)
              const nextIsName =
                text.length < 60 &&
                /^[A-Za-z0-9\s._\-]+$/.test(text) &&
                !text.includes(':') &&
                !/^\d/.test(text);

              if (text && !isNameBubble(text, participantList) && !nextIsName) {
                const key = `${name}:${text}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  results.push({ name, text, strategy: 2, timestamp: new Date().toISOString() });
                }
              }
              i += nextIsName ? 1 : 2;
            } else {
              i++;
            }
          }
        }
        if (results.length > 0) return results;
      }
    } catch (e) {
      return [{ __error: 'strategy2', message: e.message }];
    }

    // ── Strategy 3: Fallback using aria-live regions ──
    try {
      document.querySelectorAll('[aria-live="polite"]').forEach(el => {
        const raw = el.innerText?.trim();
        if (!raw || raw.length < 2 || seen.has(raw)) return;
        seen.add(raw);

        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length >= 2) {
          const name = lines[0];
          const text = lines.slice(1).join(' ');
          if (name && text && !isNameBubble(text, participantList)) {
            results.push({ name, text, strategy: 3, timestamp: new Date().toISOString() });
          }
        }
      });
    } catch (e) {
      return [{ __error: 'strategy3', message: e.message }];
    }

    return results;

  }, [...knownParticipants]).catch(err => {
    logger.error(`GoogleMeetJoiner(transcriptEngine): page.evaluate crashed: ${err.message}`);
    return [];
  });

  const errors = captions.filter(c => c.__error);
  const valid  = captions.filter(c => !c.__error);

  errors.forEach(e =>
    logger.error(`GoogleMeetJoiner(transcriptEngine): Strategy ${e.__error} error: ${e.message}`)
  );

  return valid;
}

// ═══════════════════════════════════════════════════════════
// SECTION 3 — PARTICIPANT EVENT HANDLER
// ═══════════════════════════════════════════════════════════

async function handleCaptionEvent(line) {
  if (!this.participantTracker) return;

  const text = line.trim();

  const joinMatch = text.match(/(.+?) joined/i);
  if (joinMatch) {
    const name = joinMatch[1].trim();
    logger.info(`GoogleMeetJoiner(transcriptEngine): JOIN detected → ${name}`);
    await this.participantTracker.handleParticipantJoin(name);
    return;
  }

  const leaveMatch = text.match(/(.+?) (has )?left the meeting/i);
  if (leaveMatch) {
    const name = leaveMatch[1].trim();
    logger.info(`GoogleMeetJoiner(transcriptEngine): LEAVE detected → ${name}`);
    await this.participantTracker.handleParticipantLeave(name);
  }
}

// ═══════════════════════════════════════════════════════════
// SECTION 4 — TRANSCRIPT STORAGE
// ═══════════════════════════════════════════════════════════

function buildHeader(ctx) {
  const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  return [
    '==========================================',
    'GOOGLE-MEET MEETING TRANSCRIPT',
    '==========================================',
    `Meeting ID : ${ctx.meetingId || 'N/A'}`,
    `Session ID : ${ctx.sessionId || '1'}`,
    `Date       : ${dateStr}`,
    '==========================================',
    ''
  ].join('\n');
}

async function ensureTranscriptHeader(ctx) {
  if (!ctx.filePath) return;
  try {
    const stat = await fs.stat(ctx.filePath).catch(() => null);
    if (stat && stat.size > 0) return;
    await fs.mkdir(path.dirname(ctx.filePath), { recursive: true });
    await fs.writeFile(ctx.filePath, buildHeader(ctx));
    logger.info(`GoogleMeetJoiner(transcriptEngine): Header written → ${ctx.filePath}`);
  } catch (err) {
    logger.error('GoogleMeetJoiner(transcriptEngine): Failed to write header:', err.message);
  }
}

async function saveTranscriptLine(ctx, formattedLine) {
  if (!formattedLine) {
    logger.warn('GoogleMeetJoiner(transcriptEngine): formattedLine is undefined');
    return;
  }
  if (!ctx?.filePath) {
    logger.warn('GoogleMeetJoiner(transcriptEngine): filePath missing, skipping save');
    return;
  }

  await ensureTranscriptHeader(ctx);

  try {
    await fs.mkdir(path.dirname(ctx.filePath), { recursive: true });
    await fs.appendFile(ctx.filePath, `${formattedLine}\n`);
    logger.info(`GoogleMeetJoiner(transcriptEngine): Saved → ${formattedLine}`);
  } catch (err) {
    logger.error('GoogleMeetJoiner(transcriptEngine): File write error:', err.message);
  }
}

async function exportTranscriptBuffer(ctx) {
  if (!ctx)          { logger.warn('GoogleMeetJoiner(transcriptEngine): exportTranscriptBuffer missing ctx'); return; }
  if (!ctx.filePath) { logger.warn('GoogleMeetJoiner(transcriptEngine): filePath missing'); return; }

  try {
    const stat = await fs.stat(ctx.filePath).catch(() => null);

    if (stat && stat.size > 0) {
      const footer = `\n==========================================\nTRANSCRIPT ENDED: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n==========================================\n`;
      await fs.appendFile(ctx.filePath, footer);
      logger.info(`GoogleMeetJoiner(transcriptEngine): Footer appended → ${ctx.filePath}`);
      return;
    }

    const buffer = Array.isArray(ctx.transcriptBuffer) ? ctx.transcriptBuffer : [];
    if (buffer.length === 0) {
      logger.warn('GoogleMeetJoiner(transcriptEngine): transcriptBuffer is empty');
      return;
    }

    await fs.mkdir(path.dirname(ctx.filePath), { recursive: true });
    const rawContent     = buffer.map(b => `[${b.time}] ${b.name}: ${b.text}`).join('\n') + '\n';
    const cleanedContent = cleanTranscript(rawContent);
    await fs.writeFile(ctx.filePath, buildHeader(ctx) + cleanedContent);
    logger.info(`GoogleMeetJoiner(transcriptEngine): Buffer exported → ${ctx.filePath}`);

  } catch (err) {
    logger.error('GoogleMeetJoiner(transcriptEngine): Export failed:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════
// SECTION 5 — CAPTION PROCESSOR
// ═══════════════════════════════════════════════════════════

function cleanTranscript(rawText) {
  const lines   = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const cleaned = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\[\d{2}:\d{2}:\d{2}\])\s*([^:]+):\s*(.*)$/);
    if (!match) continue;

    const [, timestamp, speaker, text] = match;
    const cleanCurrent   = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const currentTailSig = cleanCurrent.slice(-20);
    let isDuplicate      = false;

    for (let j = i + 1; j < lines.length; j++) {
      const nextMatch = lines[j].match(/^(\[\d{2}:\d{2}:\d{2}\])\s*([^:]+):\s*(.*)$/);
      if (!nextMatch) continue;
      const [, , nextSpeaker, nextText] = nextMatch;
      if (speaker !== nextSpeaker) continue;
      const cleanNext = nextText.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        cleanNext.startsWith(cleanCurrent) ||
        (currentTailSig && cleanNext.includes(currentTailSig)) ||
        cleanCurrent.includes(cleanNext)
      ) isDuplicate = true;
      break;
    }

    if (!isDuplicate) cleaned.push(`${timestamp} ${speaker}: ${text}`);
  }

  return cleaned.join('\n');
}

async function processCaptionLines(ctx, captions, lastCaptionLine, lastSpeakerName) {
  const { seenRows, transcriptBuffer, handleCaptionEvent: ctxCaptionEvent } = ctx;

  // Per-speaker last line tracking — prevents false "extension" when switching speakers
  if (!ctx._lastPerSpeaker) ctx._lastPerSpeaker = {};
  const lastPerSpeaker = ctx._lastPerSpeaker;

  for (const item of captions) {
    const { name, text } = item;

    logger.info(`GoogleMeetJoiner(transcriptEngine): Processing | ${name}: "${text}"`);

    // 1. Skip participant name bubbles
    try {
      const candidate = (text || '').trim();
      if (candidate && ctx?.participantTracker?.trackedParticipants?.has(candidate)) {
        logger.info(`GoogleMeetJoiner(transcriptEngine): Skipping name bubble: "${candidate}"`);
        continue;
      }
    } catch (e) {
      logger.debug('GoogleMeetJoiner(transcriptEngine): participantTracker check failed');
    }

    const current = (text || '').toLowerCase();

    // 2. Skip system messages
    if (INVALID_PATTERNS.some(p => p.test(current))) {
      logger.debug(`GoogleMeetJoiner(transcriptEngine): Skipping system message`);
      continue;
    }

    // 3. Per-speaker extension check
    const lastForSpeaker = (lastPerSpeaker[name] || '').toLowerCase();
    const isExtension =
      lastForSpeaker.length > 0 &&
      (current.startsWith(lastForSpeaker) || lastForSpeaker.startsWith(current)) &&
      Math.abs(current.length - lastForSpeaker.length) < 60;

    if (isExtension) {
      lastPerSpeaker[name] = text; // update per-speaker memory without writing
      logger.debug(`GoogleMeetJoiner(transcriptEngine): Extension of previous line, not saving`);
      continue;
    }

    // 4. Dedup by fingerprint
    const fingerprint = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(-30);
    const key         = `${name}:${fingerprint}`;

    if (seenRows.has(key)) {
      logger.debug(`GoogleMeetJoiner(transcriptEngine): Duplicate detected, skipping`);
      continue;
    }

    seenRows.add(key);
    if (seenRows.size > 1000) seenRows.delete(seenRows.values().next().value);

    // 5. Save caption
    lastPerSpeaker[name] = text;
    lastCaptionLine      = text;
    lastSpeakerName      = name;

    const formattedTime = new Date().toTimeString().split(' ')[0];
    const formattedLine = `[${formattedTime}] ${name}: ${text}`;

    transcriptBuffer.push({ name, text, time: formattedTime });

    const eventHandler = ctxCaptionEvent || handleCaptionEvent;
    if (eventHandler) await eventHandler.call(ctx, text);

    await saveTranscriptLine(ctx, formattedLine);
  }

  return { lastCaptionLine, lastSpeakerName };
}

// ═══════════════════════════════════════════════════════════
// SECTION 6 — TRANSCRIPT MONITOR
// ═══════════════════════════════════════════════════════════

function initContext(ctx) {
  if (!ctx.transcriptBuffer) ctx.transcriptBuffer = [];
  if (!ctx.seenRows)         ctx.seenRows = new Set();
  if (!ctx._lastPerSpeaker)  ctx._lastPerSpeaker = {};
  if (ctx.captionInterval)   clearInterval(ctx.captionInterval);
}

function filterValidCaptions(captions) {
  return captions.filter(c => {
    const valid = isValid(c.text);
    if (!valid) logger.debug(`GoogleMeetJoiner(transcriptEngine): Invalid caption dropped`);
    else        logger.info(`GoogleMeetJoiner(transcriptEngine): Valid caption: "${c.text.substring(0, 50)}..."`);
    return valid;
  });
}

const FATAL_ERROR_PATTERN = /target closed|context was destroyed|page closed|execution context|detached Frame|frame detached/i;

function isFatalError(err, ctx, page) {
  return ctx.isStopping || page?.isClosed?.() || FATAL_ERROR_PATTERN.test(err?.message || '');
}

async function handleFatalStop(ctx) {
  logger.error('GoogleMeetJoiner(transcriptEngine): Fatal error detected, stopping monitor');
  try { await exportTranscriptBuffer(ctx); } catch (e) {
    logger.error('GoogleMeetJoiner(transcriptEngine): Export on fatal stop failed');
  }
  ctx.isStopping = true;
  clearInterval(ctx.captionInterval);
  ctx.captionInterval = null;
}

async function handleIntervalError(err, ctx, page) {
  logger.error('GoogleMeetJoiner(transcriptEngine): Caption interval error:', err.message);

  if (!ctx._monitorRetry) {
    logger.warn('GoogleMeetJoiner(transcriptEngine): Transient error, retrying');
    ctx._monitorRetry = true;
    return;
  }

  if (isFatalError(err, ctx, page)) {
    await handleFatalStop(ctx);
    return;
  }

  ctx._monitorRetry = false;
}

async function runCaptionTick(ctx, page, state) {
  const knownParticipants = ctx?.participantTracker?.trackedParticipants ?? new Set();
  const captions          = await extractCaptions(page, knownParticipants);

  if (!captions?.length) return state;

  const validCaptions = filterValidCaptions(captions);
  if (!validCaptions.length) return state;

  const nextState = await processCaptionLines(
    ctx, validCaptions, state.lastCaptionLine, state.lastSpeakerName
  );

  return nextState || state;
}

function startMonitorLoop(ctx, page) {
  let state = { lastCaptionLine: '', lastSpeakerName: '' };

  ctx.captionInterval = setInterval(async () => {
    if (ctx.isStopping || !page || page?.isClosed?.()) {
      clearInterval(ctx.captionInterval);
      ctx.captionInterval = null;
      return;
    }
    try {
      state = await runCaptionTick(ctx, page, state);
    } catch (err) {
      await handleIntervalError(err, ctx, page);
    }
  }, 1500);
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

async function startTranscriptMonitor(ctx) {
  logger.info(`GoogleMeetJoiner(transcriptEngine): Starting monitor | filePath=${ctx?.filePath}`);
  initContext(ctx);
  startMonitorLoop(ctx, ctx.page);
}

async function stopTranscriptMonitor(ctx) {
  if (!ctx) {
    logger.warn('GoogleMeetJoiner(transcriptEngine): stopTranscriptMonitor missing ctx');
    return;
  }
  logger.info('GoogleMeetJoiner(transcriptEngine): Stopping monitor');
  ctx.isStopping = true;
  try { await exportTranscriptBuffer(ctx); } catch (err) {
    logger.error('GoogleMeetJoiner(transcriptEngine): Export on stop failed');
  }
  if (ctx.captionInterval) {
    clearInterval(ctx.captionInterval);
    ctx.captionInterval = null;
  }
}

function getTranscript(ctx) {
  return ctx?.transcriptBuffer || [];
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  startTranscriptMonitor,
  stopTranscriptMonitor,
  getTranscript,
  saveTranscriptLine,
  exportTranscriptBuffer,
  ensureTranscriptHeader,
  processCaptionLines,
  cleanTranscript,
  extractCaptions,
  isValid,
  INVALID_PATTERNS,
  handleCaptionEvent,
};