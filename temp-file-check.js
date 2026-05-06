const path = require('path');
const fs = require('fs').promises;
(async () => {
  const dir = path.join(__dirname, 'storage', 'transcript');
  try {
    const files = await fs.readdir(dir);
    console.log('files', files);
    const filePath = path.join(dir, 'transcript_no-id_0_2026-04-07T13-10-56-054Z.txt');
    const content = await fs.readFile(filePath, 'utf8');
    console.log('content slice:', content.slice(0, 120));
  } catch (e) {
    console.error('error', e.message);
  }
})();
