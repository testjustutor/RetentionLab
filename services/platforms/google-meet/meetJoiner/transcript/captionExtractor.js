async function extractCaptions(page) {
  if (!page) return [];

  return await page.evaluate(() => {
    const selectors = [
      '[aria-live="polite"]',
      '[jsname="dsyhDe"]',
      '[jsname="tgaKEf"]',
      '[class*="caption"]'
    ];

    let rawText = '';
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText) {
        // Use double newlines to separate distinct caption blocks
        rawText += el.innerText + '\n\n'; 
      }
    }

    const results = [];
    const blocks = rawText.split('\n\n').filter(Boolean);
    
    for (const block of blocks) {
       const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
       
       if (lines.length >= 2) {
           // Meet always puts the Name on the first line
           results.push({ name: lines[0], text: lines.slice(1).join(' ') });
       } else if (lines.length === 1) {
           // Fallback if no name is rendered
           results.push({ name: 'Action', text: lines[0] });
       }
    }

    return results;
  });
}

module.exports = { extractCaptions };