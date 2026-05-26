const { logger } = require('../../../../../utils/logger');
const { saveTranscriptLine } = require('./transcriptStorage');

async function processCaptionLines(
  ctx,
  captions,
  lastCaptionLine,
  lastSpeakerName
) {

  const {
    seenRows,
    transcriptBuffer,
    handleCaptionEvent
  } = ctx;

  for (const item of captions) {
    const { name, text } = item;

    logger.info(`DEBUG: Processing | Name: "${name}" | Text: "${text}"`);
    
    const current = (text || '').toLowerCase();
    const last = (lastCaptionLine || '').toLowerCase();

    // detect "same sentence getting extended"
    const isExtension = name === lastSpeakerName && current.startsWith(last);
    
    logger.info(`DEBUG: Logic Check | isExtension: ${isExtension} | lastSpeakerName: "${lastSpeakerName}"`);
    
    // ignore extension updates
    if (isExtension) {
      lastCaptionLine = text; // just update memory, no write
      continue;
    }

    const key = `${name}:${text}`;

    // Filter 4
    if (seenRows.has(key)) {
      continue;
    }

    seenRows.add(key);

    if (seenRows.size > 1000) {
      seenRows.clear();
    }

    lastCaptionLine = text;
    lastSpeakerName = name;

    const formattedTime = new Date().toTimeString().split(' ')[0];    
    
    const formattedLine = `[${formattedTime}] ${name}: ${text}`;

    transcriptBuffer.push({
      name,
      text,
      time: formattedTime
    });


    if (handleCaptionEvent) {
      await handleCaptionEvent(text);
    } else {
      logger.info(`GoogleMeetJoiner(captionProcessor): handleCaptionEvent NOT SET`);
    }
    
    // const finalFormattedLine = cleanTranscript(formattedLine);

    await saveTranscriptLine(ctx, formattedLine);

  }

  return { lastCaptionLine, lastSpeakerName };
}


function cleanTranscript(rawText) {
    // Split text into individual lines and remove empty ones
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line);
    const cleaned = [];

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        
        // Regex to extract [timestamp], speaker, and the spoken text
        const match = currentLine.match(/^(\[\d{2}:\d{2}:\d{2}\])\s*([^:]+):\s*(.*)$/);
        if (!match) continue;

        const [_, timestamp, speaker, text] = match;
        
        let isDuplicate = false;

        // Normalize current text for safe comparisons
        const cleanCurrent = text.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Take a unique signature from the end of the text block
        const currentTailSignature = cleanCurrent.slice(-20); 

        // UPDATE 1: Look ahead through ALL remaining lines, not just i + 1
        for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];
            const nextMatch = nextLine.match(/^(\[\d{2}:\d{2}:\d{2}\])\s*([^:]+):\s*(.*)$/);
            
            if (nextMatch) {
                const [__, nextTimestamp, nextSpeaker, nextText] = nextMatch;

                // Only evaluate lines matching the exact same speaker
                if (speaker === nextSpeaker) {
                    const cleanNext = nextText.toLowerCase().replace(/[^a-z0-9]/g, '');

                    // UPDATE 2 & 3: Run advanced overlap checks
                    if (
                        cleanNext.startsWith(cleanCurrent) || // Normal building line
                        (currentTailSignature && cleanNext.includes(currentTailSignature)) || // Handles buffer drops (e.g., "Hello Diary" cleared out)
                        cleanCurrent.includes(cleanNext) // Handles trail truncation (e.g., correcting "He?")
                    ) {
                        isDuplicate = true;
                    }
                    
                    // Break out of the look-ahead loop once we find the next instance of this speaker
                    break; 
                }
            }
        }

        // If it's not a duplicate fragment, keep it
        if (!isDuplicate) {
            cleaned.push(`${timestamp} ${speaker}: ${text}`);
        }
    }

    return cleaned.join('\n');
}



module.exports = { processCaptionLines };