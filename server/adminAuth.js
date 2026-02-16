import crypto from 'crypto';
import ldap from 'ldapjs';

/**
 * Admin authentication via LDAP bind + group membership check.
 *
 * Env vars required:
 *   LDAP_URL              – Comma-separated LDAP server URLs for failover
 *                           (e.g. ldaps://ldap1.cluster.mieweb.org:636,ldaps://ldap2.cluster.mieweb.org:636)
 *   LDAP_BASE_DN          – Base DN (e.g. dc=cluster,dc=mieweb,dc=org)
 *   LDAP_USER_BASE_DN     – Where user entries live (e.g. ou=people,dc=cluster,dc=mieweb,dc=org)
 *   LDAP_ADMIN_GROUP_DN   – Group DN whose members may access the admin panel
 *   LDAP_GROUP_MEMBER_ATTR– (optional, default "memberUid") attribute on the group entry listing members
 *   LDAP_REJECT_UNAUTHORIZED – (optional, default "true") set "false" to skip TLS cert validation
 *
 * Flow:
 *   1. POST /api/admin/auth  { username, password }
 *      a. Try each LDAP URL in order until one connects
 *      b. Anonymous search: verify user is a member of LDAP_ADMIN_GROUP_DN
 *         (rejects non-admins before triggering any MFA / push notifications)
 *      c. Bind as uid=<username>,<LDAP_USER_BASE_DN> with the supplied password
 *      d. If both succeed → create session token → { success, token, username }
 *   2. All other /api/admin/* calls include  Authorization: Bearer <token>
 */

const LOG_PREFIX = '[AdminAuth/LDAP]';

// ─── RSA key pair for encrypting credentials in transit ─────────
// Generated once at server startup; lives only in memory.
const { publicKey: RSA_PUBLIC_KEY, privateKey: RSA_PRIVATE_KEY } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
console.log(`${LOG_PREFIX} RSA key pair generated for credential encryption`);

/** Return the PEM-encoded public key (for the client to encrypt passwords) */
export const getPublicKey = () => RSA_PUBLIC_KEY;

/** Decrypt a Base64-encoded RSA-OAEP ciphertext using the server's private key */
export const decryptPassword = (encryptedBase64) => {
  const buffer = Buffer.from(encryptedBase64, 'base64');
  return crypto.privateDecrypt(
    { key: RSA_PRIVATE_KEY, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    buffer
  ).toString('utf8');
};

// ─── helpers to read LDAP env vars ──────────────────────────────
const ldapConfig = () => ({
  // Support comma-separated URLs for failover (e.g. "ldaps://ldap1:636,ldaps://ldap2:636")
  urls:              (process.env.LDAP_URL || '').split(',').map(u => u.trim()).filter(Boolean),
  url:               process.env.LDAP_URL,   // raw value for config-check logging
  baseDn:            process.env.LDAP_BASE_DN,
  userBaseDn:        process.env.LDAP_USER_BASE_DN,
  adminGroupDn:      process.env.LDAP_ADMIN_GROUP_DN,
  groupMemberAttr:   process.env.LDAP_GROUP_MEMBER_ATTR || 'memberUid',
  rejectUnauthorized: process.env.LDAP_REJECT_UNAUTHORIZED !== 'false',
});

// ─── In-memory session store ────────────────────────────────────
const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Create a session and return the token */
export const createSession = (username) => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, createdAt: Date.now() });
  console.log(`${LOG_PREFIX} Session created for user "${username}" (active sessions: ${sessions.size})`);
  return token;
};

/** Verify a session token, returns username or null */
export const verifySession = (token) => {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    console.log(`${LOG_PREFIX} Session expired for user "${session.username}", removing`);
    sessions.delete(token);
    return null;
  }
  return session.username;
};

/** Destroy a session */
export const destroySession = (token) => {
  const session = sessions.get(token);
  if (session) {
    console.log(`${LOG_PREFIX} Session destroyed for user "${session.username}" (remaining: ${sessions.size - 1})`);
  }
  sessions.delete(token);
};

// Periodically purge expired sessions to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  let purged = 0;
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(token);
      purged++;
    }
  }
  if (purged > 0) {
    console.log(`${LOG_PREFIX} Purged ${purged} expired session(s) (remaining: ${sessions.size})`);
  }
}, 60 * 60 * 1000); // every hour

// ─── LDAP helpers ───────────────────────────────────────────────

/** Escape special characters in a value used inside an LDAP filter to prevent injection */
const escapeLdapFilter = (value) =>
  value.replace(/[\\*()\/\0]/g, (ch) => '\\' + ch.charCodeAt(0).toString(16).padStart(2, '0'));

/** Build a human-readable error message from an ldapjs error */
const ldapErrorMessage = (err) => {
  // ldapjs puts the error type in err.name (e.g. "InvalidCredentialsError")
  if (err.name === 'InvalidCredentialsError' || err.lde_message === 'Invalid Credentials') {
    return 'INVALID_CREDENTIALS';
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    return 'CONNECTION_FAILED';
  }
  if (err.name === 'ConnectionError' || err.message?.includes('connect')) {
    return 'CONNECTION_FAILED';
  }
  if (err.name === 'NoSuchObjectError') {
    return 'USER_NOT_FOUND';
  }
  if (err.name === 'InsufficientAccessRightsError') {
    return 'INSUFFICIENT_ACCESS';
  }
  return 'UNKNOWN';
};

/**
 * Create an LDAP client for a single URL WITHOUT binding (anonymous),
 * execute a callback, then disconnect.
 * Used for pre-auth checks (e.g. group membership) that should not
 * trigger authentication side-effects like push notifications.
 */
const tryLdapUrlAnonymous = (url, cfg, fn) => {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (action) => (...args) => {
      if (!settled) { settled = true; action(...args); }
    };

    console.log(`${LOG_PREFIX} Creating anonymous LDAP client → ${url}`);
    const client = ldap.createClient({
      url,
      connectTimeout: 10000,
      timeout: 15000,
      tlsOptions: { rejectUnauthorized: cfg.rejectUnauthorized },
    });

    client.on('error', (err) => {
      console.error(`${LOG_PREFIX} LDAP client error (${url}): ${err.code || err.name} – ${err.message}`);
      settle(reject)(err);
    });

    client.on('connectTimeout', () => {
      console.error(`${LOG_PREFIX} LDAP connect timeout to ${url}`);
      const err = new Error(`LDAP server connection timed out: ${url}`);
      err.name = 'ConnectionError';
      settle(reject)(err);
    });

    // Anonymous bind (empty DN + empty password)
    client.bind('', '', async (err) => {
      // Track whether the anonymous bind actually succeeded
      const anonBindOk = !err;
      if (err) {
        console.warn(`${LOG_PREFIX} Anonymous bind not supported on ${url}, trying unauthenticated search…`);
      }

      try {
        const result = await fn(client, cfg);
        settle(resolve)(result);
      } catch (e) {
        // Log whether the anonymous bind succeeded to help diagnose search failures
        if (!anonBindOk) {
          console.warn(`${LOG_PREFIX} Search failed after anonymous bind was rejected on ${url} — the failure may be due to insufficient access rather than a missing entry`);
        }
        settle(reject)(e);
      } finally {
        client.unbind(() => {});
      }
    });
  });
};

/**
 * Create an LDAP client for a single URL, bind, execute a callback, then unbind.
 * Returns whatever the callback returns.
 */
const tryLdapUrl = (url, bindDn, password, cfg, fn) => {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (action) => (...args) => {
      if (!settled) { settled = true; action(...args); }
    };

    console.log(`${LOG_PREFIX} Creating LDAP client → ${url}`);
    const client = ldap.createClient({
      url,
      connectTimeout: 10000, // 10 s connect timeout
      timeout: 15000,        // 15 s operation timeout
      tlsOptions: { rejectUnauthorized: cfg.rejectUnauthorized },
    });

    client.on('error', (err) => {
      console.error(`${LOG_PREFIX} LDAP client error (${url}): ${err.code || err.name} – ${err.message}`);
      settle(reject)(err);
    });

    client.on('connectTimeout', () => {
      console.error(`${LOG_PREFIX} LDAP connect timeout to ${url}`);
      const err = new Error(`LDAP server connection timed out: ${url}`);
      err.name = 'ConnectionError';
      settle(reject)(err);
    });

    console.log(`${LOG_PREFIX} Binding as "${bindDn}" on ${url} …`);
    client.bind(bindDn, password, async (err) => {
      if (err) {
        const tag = ldapErrorMessage(err);
        console.error(`${LOG_PREFIX} Bind FAILED on ${url} (${tag}): ${err.name} – ${err.message}`);
        client.unbind(() => {});
        return settle(reject)(err);
      }

      console.log(`${LOG_PREFIX} Bind succeeded for "${bindDn}" on ${url}`);
      try {
        const result = await fn(client, cfg);
        settle(resolve)(result);
      } catch (e) {
        settle(reject)(e);
      } finally {
        client.unbind(() => {});
      }
    });
  });
};

/**
 * Create an LDAP client, bind, execute a callback, then unbind.
 * Tries each configured LDAP URL in order (failover).
 * Returns whatever the callback returns.
 */
const withLdapClient = async (bindDn, password, fn) => {
  const cfg = ldapConfig();
  const urls = cfg.urls;

  if (urls.length === 0) {
    const err = new Error('No LDAP URLs configured');
    err.ldapTag = 'LDAP_NOT_CONFIGURED';
    throw err;
  }

  let lastError;
  for (const url of urls) {
    try {
      return await tryLdapUrl(url, bindDn, password, cfg, fn);
    } catch (err) {
      lastError = err;
      const tag = ldapErrorMessage(err);
      // Only failover on connection errors; auth errors mean the server was reached
      const isConnectionError = tag === 'CONNECTION_FAILED';
      if (!isConnectionError || urls.indexOf(url) === urls.length - 1) {
        throw err;
      }
      console.warn(`${LOG_PREFIX} Connection to ${url} failed, trying next server…`);
    }
  }

  // Should not reach here, but just in case
  throw lastError;
};

/**
 * Run a callback against an anonymous LDAP connection (no user bind).
 * Tries each configured LDAP URL in order (failover).
 * Used for pre-authentication checks like group membership.
 */
const withAnonymousLdap = async (fn) => {
  const cfg = ldapConfig();
  const urls = cfg.urls;

  if (urls.length === 0) {
    const err = new Error('No LDAP URLs configured');
    err.ldapTag = 'LDAP_NOT_CONFIGURED';
    throw err;
  }

  let lastError;
  for (const url of urls) {
    try {
      return await tryLdapUrlAnonymous(url, cfg, fn);
    } catch (err) {
      lastError = err;
      const tag = ldapErrorMessage(err);
      const isConnectionError = tag === 'CONNECTION_FAILED';
      if (!isConnectionError || urls.indexOf(url) === urls.length - 1) {
        throw err;
      }
      console.warn(`${LOG_PREFIX} Anonymous connection to ${url} failed, trying next server…`);
    }
  }

  throw lastError;
};

/**
 * Search LDAP for a single entry and return its object (or null).
 */
const ldapSearchOne = (client, baseDn, filter, scope = 'sub') =>
  new Promise((resolve, reject) => {
    console.log(`${LOG_PREFIX} Searching base="${baseDn}" filter="${filter}" scope=${scope}`);
    client.search(baseDn, { filter, scope }, (err, searchRes) => {
      if (err) {
        console.error(`${LOG_PREFIX} Search error: ${err.name} – ${err.message}`);
        return reject(err);
      }
      let entry = null;
      // When scope=base, only the exact base DN entry should be returned.
      // Guard against LDAP referrals or server quirks that return unrelated entries.
      const expectedDn = scope === 'base' ? baseDn.toLowerCase() : null;
      searchRes.on('searchEntry', (e) => {
        const dn = (e.objectName || e.dn || '').toString();
        console.log(`${LOG_PREFIX} Search found entry: ${dn}`);
        if (expectedDn && dn.toLowerCase() !== expectedDn) {
          console.warn(`${LOG_PREFIX} Ignoring unexpected entry "${dn}" (expected "${baseDn}" for scope=base)`);
          return;
        }
        entry = e;
      });
      searchRes.on('error', (searchErr) => {
        console.error(`${LOG_PREFIX} Search stream error: ${searchErr.name} – ${searchErr.message}`);
        reject(searchErr);
      });
      searchRes.on('end', (result) => {
        console.log(`${LOG_PREFIX} Search completed – status ${result?.status}, entry found: ${!!entry}`);
        resolve(entry);
      });
    });
  });

/**
 * Check whether `username` is a member of the admin group.
 * Searches the group entry for the memberUid (or custom attr) matching the username.
 */
const isGroupMember = async (client, cfg, username) => {
  const safeUser = escapeLdapFilter(username);
  const filter = `(&(objectClass=*)(${cfg.groupMemberAttr}=${safeUser}))`;
  console.log(`${LOG_PREFIX} Checking group membership: group="${cfg.adminGroupDn}" attr=${cfg.groupMemberAttr} user="${username}"`);
  const entry = await ldapSearchOne(client, cfg.adminGroupDn, filter, 'base');
  const isMember = !!entry;
  console.log(`${LOG_PREFIX} Group membership result: ${isMember ? 'MEMBER' : 'NOT A MEMBER'}`);
  return isMember;
};

// ─── Public API ─────────────────────────────────────────────────

/**
 * Authenticate a user via LDAP bind + admin-group membership.
 * Resolves to { success: true, username } or throws a tagged error.
 *
 * Error tags (on err.ldapTag):
 *   INVALID_CREDENTIALS | USER_NOT_FOUND | CONNECTION_FAILED |
 *   NOT_IN_GROUP | LDAP_NOT_CONFIGURED | MISSING_INPUT | INSUFFICIENT_ACCESS | UNKNOWN
 */
export const validateCredentials = async (username, password) => {
  if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
    const err = new Error('Username and password are required');
    err.ldapTag = 'MISSING_INPUT';
    throw err;
  }

  const cfg = ldapConfig();
  if (cfg.urls.length === 0 || !cfg.userBaseDn || !cfg.adminGroupDn) {
    console.error(`${LOG_PREFIX} LDAP not configured – LDAP_URL=${cfg.url} LDAP_USER_BASE_DN=${cfg.userBaseDn} LDAP_ADMIN_GROUP_DN=${cfg.adminGroupDn}`);
    const err = new Error('LDAP is not configured on this server');
    err.ldapTag = 'LDAP_NOT_CONFIGURED';
    throw err;
  }

  const userDn = `uid=${username},${cfg.userBaseDn}`;
  console.log(`${LOG_PREFIX} ── Authenticating user "${username}" ──`);
  console.log(`${LOG_PREFIX} User DN: ${userDn}`);
  console.log(`${LOG_PREFIX} Admin group: ${cfg.adminGroupDn}`);

  try {
    // 1. Check group membership FIRST (anonymous search) — reject non-admins
    //    before binding as the user, which may trigger push notifications.
    console.log(`${LOG_PREFIX} Pre-auth: checking group membership via anonymous search`);
    const isMember = await withAnonymousLdap(async (client) => {
      return isGroupMember(client, cfg, username);
    });
    if (!isMember) {
      const groupErr = new Error('User is not a member of the admin group');
      groupErr.ldapTag = 'NOT_IN_GROUP';
      throw groupErr;
    }

    // 2. User is in the admin group — now bind as them to validate password.
    //    This is the step that may trigger push notifications / MFA.
    console.log(`${LOG_PREFIX} Group membership confirmed, proceeding with credential verification`);
    await withLdapClient(userDn, password, async () => {
      // Bind succeeded — password is valid, nothing else to do
    });
  } catch (err) {
    // Normalise the error with a tag if it doesn't already have one
    if (!err.ldapTag) {
      err.ldapTag = ldapErrorMessage(err);
    }
    console.error(`${LOG_PREFIX} Authentication FAILED for "${username}": [${err.ldapTag}] ${err.message}`);
    throw err;
  }

  console.log(`${LOG_PREFIX} Authentication SUCCEEDED for "${username}"`);
  return { success: true, username };
};

// ─── Middleware ──────────────────────────────────────────────────

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

// ─── Utility helpers (unchanged) ────────────────────────────────

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
