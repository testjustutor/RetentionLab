const fs = require('fs');
const f = 'c:\\xampp\\htdocs\\RetentionLab\\database\\headerMenuItemsSeeder.js';
let s = fs.readFileSync(f, 'utf8');

const oldBlock = "    { id: 'operations', label: 'Operations', icon: 'settings', href: null, submenu: [\r\n      { id: 'calendar-accounts', label: 'Calendar Accounts', href: '/super_admin/calendar-accounts' },\r\n      { id: 'calendar-events', label: 'Calendar Events', href: '/super_admin/calendar-events' },\r\n      { id: 'data-architecture', label: 'Data Architecture', href: '/super_admin/data-architecture' }\r\n    ]},";

const newBlock = "    { id: 'operations', label: 'Operations', icon: 'settings', href: null, submenu: [\r\n      { id: 'data-architecture', label: 'Data Architecture', href: '/super_admin/data-architecture' }\r\n    ]},";

if (!s.includes(oldBlock)) {
  console.log('BLOCK NOT FOUND - dumping nearby content:');
  const idx = s.indexOf("id: 'operations'");
  console.log(JSON.stringify(s.slice(idx, idx + 400)));
  process.exit(1);
}

s = s.replace(oldBlock, newBlock);
fs.writeFileSync(f, s);
console.log('Patched successfully');
