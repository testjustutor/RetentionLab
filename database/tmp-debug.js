require('dotenv').config();
const { db } = require('./db');
const crypto = require('crypto');

function verify(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const secretKey = process.env.PASSWORD_SECRET_KEY || '';
  const pepperedPassword = secretKey + password;
  const derived = crypto.scryptSync(pepperedPassword, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

console.log('PASSWORD_SECRET_KEY:', process.env.PASSWORD_SECRET_KEY ? 'SET (' + process.env.PASSWORD_SECRET_KEY.substring(0, 5) + '...)' : 'NOT SET');

db.get('SELECT email, password_hash FROM users WHERE email = ?', ['admin@automationbot.com'], (err, row) => {
  if (err) { console.log('Error:', err.message); process.exit(1); return; }
  if (!row) { console.log('User not found'); process.exit(1); return; }
  console.log('Stored email:', row.email);
  console.log('Stored hash:', row.password_hash);
  console.log('Verification result:', verify('Adm1nDemo#2026$Tz4', row.password_hash));
  process.exit(0);
});