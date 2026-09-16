/**
 * root/middleware/auth.js
 */
const jwt = require('jsonwebtoken');

// FIX: was `process.env.JWT_SECRET || 'supersecret_jwt_key_change_me'` - a
// hardcoded fallback secret sitting in source control. If JWT_SECRET was
// ever unset in any environment (a fresh clone, a misconfigured deploy),
// the app would silently sign/verify tokens with this well-known string -
// anyone who'd seen this file could forge a valid token for any user,
// any role, including super_admin. Failing fast instead: a missing secret
// now crashes at startup with a clear error rather than degrading silently
// into an insecure default.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required - refusing to start with an insecure default.');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const JWT_EXPIRES_MS = Number(process.env.JWT_EXPIRES_MS) || 2 * 60 * 60 * 1000;

// FIX: ENABLE_HEADER_AUTH is a dev-only bypass (see requireAuth below) that
// lets a request impersonate any user/role via plain x-user-id/x-user-role
// headers, no token required. The only thing stopping it from being live in
// production used to be a code comment ("Never enable in production") that
// nothing actually enforced. Refusing to start instead if it's ever left on
// alongside NODE_ENV=production.
if (process.env.ENABLE_HEADER_AUTH === 'true' && process.env.NODE_ENV === 'production') {
  throw new Error('ENABLE_HEADER_AUTH must never be enabled when NODE_ENV=production - refusing to start.');
}

function signToken(user) {
  const payload = {
    id: user.id,
    user_uuid: user.user_uuid || null,
    role_id: user.role_id ?? user.role_id,
    role_name: user.role_name,
    company_id: user.company_id || null,
    email: user.email || null
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  if (req.user && req.user.id) return next();

  const authHeader = req.get('authorization');
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || req.cookies?.auth_token;

  if (!token) {
    // Development/testing-only passthrough. Disabled unless explicitly opted in via
    // ENABLE_HEADER_AUTH=true so production cannot impersonate a user by spoofing headers.
    // (The startup guard above backstops the "never in production" part.)
    if (process.env.ENABLE_HEADER_AUTH === 'true') {
      const id = req.get('x-user-id');
      const role = req.get('x-user-role');
      const company = req.get('x-user-company');
      if (id) {
        req.user = {
          id: Number(id),
          role_name: role || 'employee',
          company_id: company ? Number(company) : null
        };
        return next();
      }
    }
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized: invalid token' });

  req.user = {
    id: payload.id,
    user_uuid: payload.user_uuid || null,
    role_id: payload.role_id || null,
    role_name: payload.role_name,
    company_id: payload.company_id,
    email: payload.email
  };

  return next();
}

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const role = (req.user.role_name || '').toString();
    if (allowed.includes(role) || allowed.includes('*')) return next();
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  };
}

module.exports = { requireAuth, requireRole, signToken, verifyToken, JWT_EXPIRES_MS };
