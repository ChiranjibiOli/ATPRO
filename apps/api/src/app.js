import { createServer } from 'node:http';
import { newToken, newUser, normalizeEmail, passwordHash, passwordMatches, publicUser, tokenDigest, validateRegistration } from './auth.js';

const respond = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
};
const maxBody = 8192;
async function bodyJson(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBody) { const err = new Error('Request too large'); err.status = 413; throw err; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const err = new Error('Invalid JSON'); err.status = 400; throw err; }
}
function createLimiter({ limit = 12, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return (key) => {
    const now = Date.now();
    if (buckets.size > 5000) for (const [k,v] of buckets) if (v.until < now) buckets.delete(k);
    let entry = buckets.get(key);
    if (!entry || entry.until < now) entry = { count: 0, until: now + windowMs };
    entry.count++;
    buckets.set(key, entry);
    return entry.count <= limit;
  };
}
const badCredentials = { error: 'Invalid email or password.' };
export function createApp({ store, now = () => Date.now(), limiter = createLimiter() }) {
  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') return respond(res, 200, { status: 'ok' });
      const isAuth = path === '/api/auth/register' || path === '/api/auth/login';
      if (isAuth && req.method === 'POST') {
        if (!limiter(req.socket.remoteAddress + ':' + path)) return respond(res, 429, { error: 'Too many attempts. Try again later.' });
        const data = await bodyJson(req);
        if (path.endsWith('register')) {
          const { errors, clean } = validateRegistration(data);
          if (Object.keys(errors).length) return respond(res, 400, { error: 'Check the form fields.', fields: errors });
          const hashed = await passwordHash(data.password);
          const result = await store.transaction(db => {
            if (db.users.some(u => u.email === clean.email)) return { value: null };
            const user = newUser(clean, hashed);
            db.users.push(user);
            return { write: true, value: publicUser(user) };
          });
          return result ? respond(res, 201, { user: result }) : respond(res, 409, { error: 'This email is already registered.' });
        }
        const email = normalizeEmail(data?.email);
        if (!email || typeof data?.password !== 'string') return respond(res, 400, { error: 'Email and password are required.' });
        const db = await store.read();
        const user = db.users.find(u => u.email === email);
        // Always run password hashing, even for unknown users, to reduce account enumeration via timing.
        const ok = user ? await passwordMatches(data.password, user.passwordSalt, user.passwordHash)
          : await passwordMatches(data.password, '00000000000000000000000000000000', '00'.repeat(64));
        if (!user || !ok) return respond(res, 401, badCredentials);
        const token = newToken();
        const expiresAt = new Date(now() + 8 * 60 * 60 * 1000).toISOString();
        await store.transaction(db2 => {
          db2.sessions = db2.sessions.filter(s => Date.parse(s.expiresAt) > now());
          db2.sessions.push({ tokenHash: tokenDigest(token), userId: user.id, expiresAt, createdAt: new Date(now()).toISOString() });
          return { write: true };
        });
        return respond(res, 200, { token, expiresAt, user: publicUser(user) });
      }
      if ((path === '/api/auth/me' && req.method === 'GET') || (path === '/api/auth/logout' && req.method === 'POST')) {
        const header = req.headers.authorization ?? '';
        const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header)?.[1];
        if (!token) return respond(res, 401, { error: 'Authentication required.' });
        const digest = tokenDigest(token);
        if (path.endsWith('logout')) {
          const found = await store.transaction(db => {
            const count = db.sessions.length;
            db.sessions = db.sessions.filter(s => s.tokenHash !== digest);
            return { write: count !== db.sessions.length, value: count !== db.sessions.length };
          });
          return found ? respond(res, 200, { message: 'Logged out.' }) : respond(res, 401, { error: 'Session expired.' });
        }
        const db = await store.read();
        const session = db.sessions.find(s => s.tokenHash === digest && Date.parse(s.expiresAt) > now());
        const user = session && db.users.find(u => u.id === session.userId);
        return user ? respond(res, 200, { user: publicUser(user) }) : respond(res, 401, { error: 'Session expired.' });
      }
      return respond(res, 404, { error: 'Not found.' });
    } catch (error) {
      if (error.status === 400 || error.status === 413) return respond(res, error.status, { error: error.message });
      console.error('API failure:', error);
      return respond(res, 503, { error: 'Service temporarily unavailable.' });
    }
  });
}
