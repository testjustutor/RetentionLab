/**
 * Extracts captions from a Google Meet page context.
 * @param {import('puppeteer').Page} page 
 */
async function extractCaptions(page) {
  if (!page) return [];

  return await page.evaluate(() => {
    // Select all potential container elements
    const selectors = [
      '[aria-live="polite"]',
      '[jsname="dsyhDe"]',
      '[jsname="tgaKEf"]',
      '[class*="caption"]'
    ];

    const results = [];
    const seen = new Set();

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      
      elements.forEach(el => {
        const text = el.innerText ? el.innerText.trim() : '';
        if (!text || seen.has(text)) return;

        seen.add(text);
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        if (lines.length >= 2) {
          results.push({ name: lines[0], text: lines.slice(1).join(' ') });
        } else if (lines.length === 1) {
          results.push({ name: 'System/Unknown', text: lines[0] });
        }
      });
    }

    return results;
  });
}

module.exports = { extractCaptions };