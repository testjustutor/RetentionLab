/**
 * services/platforms/google-meet/transcriptEngine.js
 *
 * Merged transcript engine: caption extraction, validation, processing,
 * participant event handling, storage, and real-time monitoring.
 */

'use strict';

const fs   = require('fs').promises;
const path = require('path');
const { logger } = require('../../../utils/logger');
const { logThrottled } = require('../../../utils/logThrottle');
const TranscriptModel = require('../../../models/transcripts/transcriptModel');
const MeetingSessionModel = require('../../../models/meetings/meeting-session/meetingSessionModel');

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

function buildFooter() {
  return [
    '',
    '==========================================',
    `TRANSCRIPT ENDED: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    '==========================================',
    ''
  ].join('\n');
}

function longestCommonPrefix(a, b) {
  const minLen = Math.min(a.length, b.length);
  let i = 0;
  while (i < minLen && a[i] === b[i]) {
    i += 1;
  }
  return a.slice(0, i);
}

// Kept for backward compatibility (still exported) but no longer used by
// exportTranscriptBuffer()/buildFinalCaptionSection() — see
// extractFinalUtterances()/formatFinalUtterances() below, which replaced
// this prefix-stripping heuristic with a simpler, correct approach.
function compressTranscriptUpdates(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const compressed = [];
  const lastBySpeaker = {};
  const greetingPattern = /^(hello|hi|hey|good (morning|afternoon|evening))[!,]?\s+/i;

  for (const line of lines) {
    const match = line.match(/^(\[\d{2}:\d{2}:\d{2}\])\s*([^:]+):\s*(.*)$/);
    if (!match) continue;

    const [, timestamp, speaker, text] = match;
    let cleanedText = text;
    const previousText = lastBySpeaker[speaker];

    if (previousText) {
      const prefix = longestCommonPrefix(previousText, cleanedText);
      if (prefix.length > 0 && prefix.length < cleanedText.length) {
        cleanedText = cleanedText.slice(prefix.length).trim();
        cleanedText = cleanedText.replace(/^[\s,;:.!?-]+/, '');
      }
    }

    if (greetingPattern.test(cleanedText)) {
      const trimmed = cleanedText.replace(greetingPattern, '').trim();
      if (trimmed.length > 0) {
        cleanedText = trimmed;
      }
    }

    compressed.push(`${timestamp} ${speaker}: ${cleanedText}`);
    lastBySpeaker[speaker] = text;
  }

  return compressed.join('\n');
}

// ═══════════════════════════════════════════════════════════
// SECTION 4b — FINAL UTTERANCE EXTRACTION (FINAL CAPTION SNAPSHOT)
// ═══════════════════════════════════════════════════════════
//
// Google Meet's live captions are CUMULATIVE: while one person keeps
// talking, Meet re-emits growing/corrected versions of the SAME utterance
// as separate lines under that speaker (e.g. "Hello" → "Hello, assistant!"
// → "Hello, assistant! Okay, waiting session.") until the speaker changes.
// The old cleanTranscript()/compressTranscriptUpdates() pipeline tried to
// dedupe/compress this with prefix-stripping heuristics, which could mangle
// text. This instead just groups consecutive same-speaker lines into one
// run and keeps the LAST line of each run — the fullest/most-corrected
// version of that utterance — tagged with the run's start/end timestamps.
const TRANSCRIPT_LINE_PATTERN = /^\[(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+(.*)$/;

function parseTranscriptLines(rawText) {
  const lines = [];
  for (const rawLine of (rawText || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(TRANSCRIPT_LINE_PATTERN);
    if (!match) continue;
    const [, ts, speaker, text] = match;
    lines.push({ ts, speaker: speaker.trim(), text: text.trim() });
  }
  return lines;
}

function extractFinalUtterances(rawText) {
  const lines = parseTranscriptLines(rawText);
  const utterances = [];
  let currentSpeaker = null;
  let startTs = null;
  let lastLine = null;

  for (const entry of lines) {
    if (entry.speaker !== currentSpeaker) {
      if (lastLine !== null) {
        utterances.push({
          speaker: currentSpeaker,
          start: startTs,
          end: lastLine.ts,
          text: lastLine.text,
        });
      }
      currentSpeaker = entry.speaker;
      startTs = entry.ts;
    }
    lastLine = entry;
  }

  if (lastLine !== null) {
    utterances.push({
      speaker: currentSpeaker,
      start: startTs,
      end: lastLine.ts,
      text: lastLine.text,
    });
  }

  return utterances;
}

function formatFinalUtterances(rawText) {
  return extractFinalUtterances(rawText)
    .map(u => `[${u.start} - ${u.end}] ${u.speaker}: ${u.text}`)
    .join('\n');
}

// Builds the COMPLETE final transcript file content in one shot: header,
// blank line, one line per final utterance (grouped/deduped — see
// extractFinalUtterances() above), blank line, footer. No "FINAL CAPTION
// SNAPSHOT" sub-banner and no raw/intermediate caption lines — those were
// only ever a live, in-progress view; the finished file should read as one
// clean transcript, not the live log with a cleaned copy appended after it.
function buildFinalTranscriptContent(ctx, rawContent) {
  const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const utterancesText = rawContent ? formatFinalUtterances(rawContent) : '';

  return [
    '==========================================',
    'GOOGLE-MEET MEETING TRANSCRIPT',
    '==========================================',
    `Meeting ID : ${ctx.meetingId || 'N/A'}`,
    `Session ID : ${ctx.sessionId || '1'}`,
    `Date       : ${dateStr}`,
    '==========================================',
    '',
    utterancesText,
    '',
    '==========================================',
    `TRANSCRIPT ENDED: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    '==========================================',
    ''
  ].join('\n');
}

// Kept for backward compatibility (still exported); no longer used by
// exportTranscriptBuffer() — see buildFinalTranscriptContent() above.
function buildFinalCaptionSection(rawContent) {
  const finalContent = formatFinalUtterances(rawContent);
  return [
    '',
    '==========================================',
    'FINAL CAPTION SNAPSHOT',
    'This is the last full caption data collected at meeting end.',
    '==========================================',
    '',
    finalContent,
    buildFooter()
  ].join('\n');
}

async function readTranscriptLinesFromFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const transcriptLines = [];
    let insideTranscript = false;

    for (const line of lines) {
      if (!insideTranscript && /^\[\d{2}:\d{2}:\d{2}\]/.test(line)) {
        insideTranscript = true;
      }
      if (insideTranscript) {
        if (line === '==========================================' && transcriptLines.length > 0) {
          break;
        }
        if (/^\[\d{2}:\d{2}:\d{2}\]/.test(line)) {
          transcriptLines.push(line);
        }
      }
    }

    return transcriptLines;
  } catch (err) {
    return [];
  }
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
    // LOG VOLUME: fires once per accepted caption line (every ~1.5s per
    // active speaker - see startMonitorLoop's polling interval below) and
    // just echoes content already durably written to the transcript file
    // above, so it belongs at debug, not info - the info-level production
    // log file (see utils/logger.js's File transport level:'info') would
    // otherwise grow by thousands of lines per hour per speaker for no
    // operational benefit. Still visible when LOG_LEVEL=debug.
    logger.debug(`GoogleMeetJoiner(transcriptEngine): Saved → ${formattedLine}`);
  } catch (err) {
    logger.error('GoogleMeetJoiner(transcriptEngine): File write error:', err.message);
  }
}

async function exportTranscriptBuffer(ctx) {
  if (!ctx)          { logger.warn('GoogleMeetJoiner(transcriptEngine): exportTranscriptBuffer missing ctx'); return; }
  if (!ctx.filePath) { logger.warn('GoogleMeetJoiner(transcriptEngine): filePath missing'); return; }

  if (ctx._exportedTranscript) {
    logger.info('GoogleMeetJoiner(transcriptEngine): Transcript already exported, skipping duplicate');
    return;
  }

  try {
    const buffer = Array.isArray(ctx.transcriptBuffer) ? ctx.transcriptBuffer : [];
    let rawContent = '';

    if (buffer.length > 0) {
      rawContent = buffer.map(b => `[${b.time}] ${b.name}: ${b.text}`).join('\n') + '\n';
    } else {
      // Fallback for the unusual case where the in-memory buffer is empty
      // (e.g. process restarted mid-meeting) but a partial file with raw
      // caption lines from an earlier run already exists on disk.
      const fileLines = await readTranscriptLinesFromFile(ctx.filePath);
      if (fileLines.length > 0) {
        rawContent = fileLines.join('\n') + '\n';
      }
    }

    // Always a full, single overwrite of the file with the complete, clean
    // transcript — header, grouped utterances, footer, nothing else. This
    // replaces whatever raw/intermediate lines any earlier live
    // ensureTranscriptHeader()/saveTranscriptLine() calls wrote during the
    // meeting (those exist only as a crash-safety net; the finished file on
    // disk should never contain them).
    await fs.mkdir(path.dirname(ctx.filePath), { recursive: true });
    await fs.writeFile(ctx.filePath, buildFinalTranscriptContent(ctx, rawContent));
    ctx._exportedTranscript = true;
    logger.info(`GoogleMeetJoiner(transcriptEngine): Final transcript written → ${ctx.filePath}`);

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
  const { seenRows, transcriptBuffer } = ctx;

  // Per-speaker last line tracking — prevents false "extension" when switching speakers
  if (!ctx._lastPerSpeaker) ctx._lastPerSpeaker = {};
  const lastPerSpeaker = ctx._lastPerSpeaker;

  for (const item of captions) {
    const { name, text } = item;

    // THROTTLED (not silenced): this fires once per caption item on EVERY
    // ~1.5s poll tick (see startMonitorLoop below) - unthrottled that's
    // thousands of lines/hour in the production log. The poll tick itself,
    // and caption processing below, are UNCHANGED and still run every time -
    // only this logger.info() call is throttled to at most once per 60s per
    // meeting (see utils/logThrottle.js). Level stays 'info', as before.
    logThrottled(
      'info',
      `transcript:processing:${ctx?.meetingUrl || 'unknown'}`,
      `GoogleMeetJoiner(transcriptEngine): Processing | ${name}: "${text}"`
    );

    // 1. Skip participant name bubbles
    try {
      const candidate = (text || '').trim();
      if (candidate && ctx?.participantTracker?.trackedParticipants?.has(candidate)) {
        logger.debug(`GoogleMeetJoiner(transcriptEngine): Skipping name bubble: "${candidate}"`);
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

    // ── Record the speaker as a participant (participants + participant_attendance_sessions).
    // A real speaker name parsed from the captions is proof of a human participant.
    // The tracker dedupes by name, so repeated caption lines only ever write once.
    // The bot's own display name is NEVER a participant.
    try {
      const tracker = ctx?.participantTracker;
      const speakerName = (name || '').trim();
      const speakerKey = speakerName.toLowerCase();
      const botNameKey = (ctx?.botName || '').trim().toLowerCase();
      if (tracker && speakerName && speakerKey !== botNameKey && !speakerKey.includes('(you)') && !speakerKey.includes('(me)')) {
        const joined = await tracker.handleParticipantJoin(speakerName);
        if (joined && (joined.event === 'first_join' || joined.event === 'rejoin')) {
          logger.info(`GoogleMeetJoiner(transcriptEngine): Participant recorded from captions: ${speakerName} (${joined.event})`);
        }
      }
    } catch (e) {
      logger.debug(`GoogleMeetJoiner(transcriptEngine): Could not record caption speaker as participant: ${e.message}`);
    }

    const formattedTime = new Date().toTimeString().split(' ')[0];
    const formattedLine = `[${formattedTime}] ${name}: ${text}`;

    transcriptBuffer.push({ name, text, time: formattedTime });

    await saveTranscriptLine(ctx, formattedLine);

    // First real caption line captured for this session — this is the
    // "human speaks / conversation starts" moment: link the transcript file
    // to meeting_sessions AND flip the session from 'human_detected' (set
    // when the row was created, before anyone had said anything) to
    // 'processing' now that real conversation content actually exists.
    // sessionId/fileName come from the CaptionMonitor the joiner was given
    // (joiner.setCaptionMonitor()), since ctx (the joiner) has no sessionId
    // of its own.
    const monitor = ctx?.captionMonitor;
    if (!ctx._transcriptFileSaved && monitor?.sessionId && monitor?.fileName) {
      ctx._transcriptFileSaved = true;
      Promise.all([
        TranscriptModel.saveTranscriptFile(monitor.sessionId, monitor.fileName),
        MeetingSessionModel.updateStatus(monitor.sessionId, 'processing')
      ])
        .then(() => logger.info(`GoogleMeetJoiner(transcriptEngine): Transcript file linked & session ${monitor.sessionId} marked processing (first caption captured)`))
        .catch(err => logger.error(`GoogleMeetJoiner(transcriptEngine): Error updating session on first caption: ${err.message}`));
    }
  }

  return { lastCaptionLine, lastSpeakerName };
}

// ═══════════════════════════════════════════════════════════
// SECTION 6 — TRANSCRIPT MONITOR
// ═══════════════════════════════════════════════════════════

function initContext(ctx) {
  ctx.transcriptBuffer = [];
  ctx.seenRows = new Set();
  ctx._lastPerSpeaker = {};
  if (ctx.captionInterval) clearInterval(ctx.captionInterval);
  logger.info('GoogleMeetJoiner(transcriptEngine): Transcript context reset for new meeting');
}

function filterValidCaptions(captions, ctx) {
  return captions.filter(c => {
    const valid = isValid(c.text);
    // "Invalid caption dropped" stays at debug - purely diagnostic noise,
    // not something production needs to see even throttled.
    if (!valid) {
      logger.debug(`GoogleMeetJoiner(transcriptEngine): Invalid caption dropped`);
    } else {
      // THROTTLED (not silenced): runs on every ~1.5s poll tick for every
      // caption currently on screen (see startMonitorLoop below) - the poll
      // tick and the validity check above are UNCHANGED and still run every
      // time; only this logger.info() call is throttled to at most once per
      // 60s per meeting (see utils/logThrottle.js). Level stays 'info'.
      logThrottled(
        'info',
        `transcript:valid-caption:${ctx?.meetingUrl || 'unknown'}`,
        `GoogleMeetJoiner(transcriptEngine): Valid caption: "${c.text.substring(0, 50)}..."`
      );
    }
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
  const trackedParticipants = ctx?.participantTracker?.trackedParticipants;
  const knownParticipants = trackedParticipants instanceof Map
    ? new Set(trackedParticipants.keys())
    : trackedParticipants ?? new Set();
  const captions          = await extractCaptions(page, knownParticipants);

  if (!captions?.length) return state;

  const validCaptions = filterValidCaptions(captions, ctx);
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
  compressTranscriptUpdates,
  extractFinalUtterances,
  formatFinalUtterances,
  buildFinalTranscriptContent,
  extractCaptions,
  isValid,
  INVALID_PATTERNS,
};