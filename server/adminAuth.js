import crypto from 'crypto';

/**
 * Admin authentication via env-var credentials + session tokens.
 *
 * Env vars required:
 *   ADMIN_USERNAME  – admin login username
 *   ADMIN_PASSWORD  – admin login password
 *
 * Flow:
 *   1. POST /api/admin/auth  { username, password }  →  { success, token }
 *   2. All other /api/admin/* calls include  Authorization: Bearer <token>
 */

// In-memory session store  { token → { username, createdAt } }
// Sessions expire after SESSION_TTL_MS (default 8 hours)
const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Create a session and return the token */
export const createSession = (username) => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, createdAt: Date.now() });
  return token;
};

/** Validate credentials against env vars (timing-safe, constant-time) */
export const validateCredentials = (username, password) => {
  if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) return false;

  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminUser || !adminPass) return false;

  // Hash all values to fixed-size digests so timingSafeEqual never short-circuits on length
  const hash = (val) => crypto.createHash('sha256').update(val).digest();

  const userMatch = crypto.timingSafeEqual(hash(username), hash(adminUser));
  const passMatch = crypto.timingSafeEqual(hash(password), hash(adminPass));
  return userMatch && passMatch;
};

/** Verify a session token, returns username or null */
export const verifySession = (token) => {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return session.username;
};

/** Destroy a session */
export const destroySession = (token) => sessions.delete(token);

/**
 * Middleware: require a valid Bearer session token.
 * Sets req.adminUser on success.
 */
export const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authorization required' }));
    return;
  }

  const username = verifySession(token);
  if (!username) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or expired session' }));
    return;
  }

  req.adminUser = username;
  next();
};

/** Parse JSON body from request (rejects if payload exceeds maxBytes) */
export const parseJsonBody = (req, maxBytes = 1024 * 1024) => new Promise((resolve, reject) => {
  let body = '';
  let size = 0;
  let rejected = false;
  req.on('data', chunk => {
    if (rejected) return;
    size += chunk.length;
    if (size > maxBytes) {
      rejected = true;
      req.destroy();
      reject(new Error('Payload too large'));
      return;
    }
    body += chunk.toString();
  });
  req.on('end', () => {
    if (rejected) return;
    try { resolve(body ? JSON.parse(body) : {}); }
    catch { reject(new Error('Invalid JSON')); }
  });
  req.on('error', err => {
    if (!rejected) reject(err);
  });
});

/** Send JSON response */
export const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};
