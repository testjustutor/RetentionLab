const fs = require('fs');
const path = require('path');
const files = [
  'public/admin/archives.html',
  'public/admin/calendar-accounts.html',
  'public/admin/calendar-events.html',
  'public/admin/index.html',
  'public/admin/profile.html',
  'public/admin/settings.html',
  'public/super_admin/archives.html',
  'public/super_admin/assets.html',
  'public/super_admin/audit.html',
  'public/super_admin/bot.html',
  'public/super_admin/calendar-accounts.html',
  'public/super_admin/calendar-events.html',
  'public/super_admin/data-architecture.html',
  'public/super_admin/index.html',
  'public/super_admin/profile.html',
  'public/super_admin/settings.html',
  'public/employee/index.html',
  'public/reviewer/index.html'
];

for (const rel of files) {
  const p = path.join(__dirname, '..', rel);
  let content = fs.readFileSync(p, 'utf8');
  const orig = content;
  const headerRegex = /\s*<header[^>]*>[\s\S]*?<\/header>\s*/i;

  if (headerRegex.test(content)) {
    content = content.replace(headerRegex, '    <div id="header-placeholder"></div>\n');
  } else {
    console.error('NO HEADER FOUND:', rel);
  }

  if (!/load-components\.js/.test(content)) {
    content = content.replace(/<\/body>/i, '  <script src="../js/load-components.js"></script>\n</body>');
  }

  if (content !== orig) {
    fs.writeFileSync(p, content, 'utf8');
    console.log('UPDATED', rel);
  } else {
    console.log('UNCHANGED', rel);
  }
}
