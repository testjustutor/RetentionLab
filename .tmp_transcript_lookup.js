const fs = require('fs');
const path = require('path');
const transcriptDir = path.join(process.cwd(), 'storage', 'transcript');
console.log('transcriptDir', transcriptDir, fs.existsSync(transcriptDir));
const files = fs.readdirSync(transcriptDir).filter(f => f.endsWith('.txt'));
console.log('files', files);
const allTrans = files.map(filename => {
  const filePath = path.join(transcriptDir, filename);
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/Meeting\s*ID\s*:\s*(.+)/i);
  const fileMeetingId = match ? match[1].trim() : null;
  const stat = fs.statSync(filePath);
  return { filePath, filename, fileMeetingId, mtime: stat.mtimeMs };
});
const exact = allTrans.filter(x => x.fileMeetingId === '3689605898' || x.filename.includes('3689605898'));
console.log('exact count', exact.length, exact);
allTrans.sort((a,b)=>b.mtime-b.mtime);
console.log('fallback', allTrans[0]);
