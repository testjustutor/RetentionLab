const fs = require('fs');
const path = require('path');
const dirs = ['public/admin', 'public/super_admin', 'public/employee', 'public/reviewer'];
const summary = [];
for (const dir of dirs) {
  const files = fs.readdirSync(path.join(__dirname, '..', dir)).filter(f => f.endsWith('.html'));
  for (const file of files) {
    const p = path.join(__dirname, '..', dir, file);
    const c = fs.readFileSync(p, 'utf8');
    const hasHeader = /<header[^>]*>/i.test(c);
    const hasPlaceholder = /id="header-placeholder"/.test(c);
    const hasLoader = /load-components\.js/.test(c);
    summary.push({file: path.join(dir, file), hasHeader, hasPlaceholder, hasLoader});
  }
}
console.log(JSON.stringify(summary, null, 2));
