import { createServer } from 'node:http';
import { validateVehicle, createVehicle } from './vehicles.js';
import { validateAvailability, validateEligibilityQuery, previewVehicleEligibility } from './availability.js';
import { validateTransportRequest, createRequest } from './requests.js';
import { previewRequestMatches } from './matching.js';
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
      if (path === '/api/farmer/overview' && req.method === 'GET') {
        const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
        if (!token) return respond(res, 401, { error: 'Authentication required.' });
        const db = await store.read();
        const session = db.sessions.find(s => s.tokenHash === tokenDigest(token) && Date.parse(s.expiresAt) > now());
        const user = session && db.users.find(u => u.id === session.userId);
        if (!user) return respond(res, 401, { error: 'Session expired.' });
        if (user.role !== 'farmer') return respond(res, 403, { error: 'Farmer access required.' });
        // Only count persisted records belonging to the authenticated farmer.
        // Collections are introduced by the upcoming request/trip implementation.
        const requests = (db.requests ?? []).filter(r => r.farmerId === user.id);
        const trips = (db.trips ?? []).filter(t =>
          (db.tripAssignments ?? []).some(a => a.tripId === t.id &&
            requests.some(r => r.id === a.requestId)));
        return respond(res, 200, {
          user: publicUser(user),
          summary: {
            totalRequests: requests.length,
            pendingRequests: requests.filter(r => r.status === 'pending').length,
            activeTrips: trips.filter(t => ['accepted', 'in_transit'].includes(t.status)).length,
          },
        });
      }
      if (path === '/api/farmer/requests' && ['GET', 'POST'].includes(req.method)) {
        const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
        if (!token) return respond(res, 401, { error: 'Authentication required.' });
        const db = await store.read();
        const session = db.sessions.find(s => s.tokenHash === tokenDigest(token) && Date.parse(s.expiresAt) > now());
        const user = session && db.users.find(u => u.id === session.userId);
        if (!user) return respond(res, 401, { error: 'Session expired.' });
        if (user.role !== 'farmer') return respond(res, 403, { error: 'Farmer access required.' });
        if (req.method === 'GET') {
          const requests = (db.requests ?? []).filter(r => r.farmerId === user.id)
            .sort((a,b) => b.createdAt.localeCompare(a.createdAt));
          return respond(res, 200, { requests });
        }
        const data = await bodyJson(req);
        const { fields, clean } = validateTransportRequest(data, now());
        if (Object.keys(fields).length) return respond(res, 400, { error: 'Check the request fields.', fields });
        const request = createRequest(clean, user.id, now());
        await store.transaction(db2 => {
          db2.requests ??= [];
          db2.requests.push(request);
          return { write: true };
        });
        return respond(res, 201, { request });
      }
      const matchRoute = /^\\/api\\/farmer\\/requests\\/([0-9a-f-]{36})\\/matches$/.exec(path);
      if (matchRoute && req.method === 'GET') {
        const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
        if (!token) return respond(res, 401, { error: 'Authentication required.' });
        const db = await store.read();
        const session = db.sessions.find(s => s.tokenHash === tokenDigest(token) && Date.parse(s.expiresAt) > now());
        const user = session && db.users.find(u => u.id === session.userId);
        if (!user) return respond(res, 401, { error: 'Session expired.' });
        if (user.role !== 'farmer') return respond(res, 403, { error: 'Farmer access required.' });
        const request = (db.requests ?? []).find(r => r.id === matchRoute[1] && r.farmerId === user.id);
        if (!request) return respond(res, 404, { error: 'Request not found.' });
        if (request.status !== 'pending') return respond(res, 409, { error: 'Only pending requests can be matched.' });
        return respond(res, 200, previewRequestMatches(db, request, now()));
      }
      // Farmer-owned request lifecycle: do not reveal the existence of another farmer's ID.
      const parts = path.split('/');
      const detailMatch = parts.length >= 5 && parts.length <= 6 &&
        parts[1] === 'api' && parts[2] === 'farmer' && parts[3] === 'requests' &&
        /^[0-9a-f-]{36}/.test(parts[4]) && parts[4].length === 36 &&
        (parts.length === 5 || parts[5] === 'cancel')
        ? [null, parts[4], parts.length === 6 ? '/cancel' : undefined] : null;
      if (detailMatch && ((req.method === 'GET' && !detailMatch[2]) ||
          (req.method === 'PATCH' && !detailMatch[2]) ||
          (req.method === 'POST' && detailMatch[2] === '/cancel'))) {
        const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
        if (!token) return respond(res, 401, { error: 'Authentication required.' });
        const db = await store.read();
        const session = db.sessions.find(s => s.tokenHash === tokenDigest(token) && Date.parse(s.expiresAt) > now());
        const user = session && db.users.find(u => u.id === session.userId);
        if (!user) return respond(res, 401, { error: 'Session expired.' });
        if (user.role !== 'farmer') return respond(res, 403, { error: 'Farmer access required.' });
        const own = (db.requests ?? []).find(r => r.id === detailMatch[1] && r.farmerId === user.id);
        if (!own) return respond(res, 404, { error: 'Request not found.' });
        if (req.method === 'GET') return respond(res, 200, { request: { ...own, revision: own.revision ?? 1 } });
        const input = await bodyJson(req);
        if (!Number.isSafeInteger(input?.revision) || input.revision < 1)
          return respond(res, 400, { error: 'A valid request revision is required.', fields: { revision: 'Revision must be a positive integer.' } });
        let clean;
        if (req.method === 'PATCH') {
          const validation = validateTransportRequest(input, now());
          if (Object.keys(validation.fields).length)
            return respond(res, 400, { error: 'Check the request fields.', fields: validation.fields });
          clean = validation.clean;
        }
        const outcome = await store.transaction(data => {
          const current = (data.requests ?? []).find(r => r.id === detailMatch[1] && r.farmerId === user.id);
          if (!current) return { value: { status: 404, error: 'Request not found.' } };
          if (current.status !== 'pending' || (current.revision ?? 1) !== input.revision)
            return { value: { status: 409, error: 'Request changed or is no longer pending. Reload details.' } };
          if (req.method === 'PATCH') Object.assign(current, clean);
          else current.status = 'cancelled';
          current.revision = (current.revision ?? 1) + 1;
          current.updatedAt = new Date(now()).toISOString();
          return { write: true, value: { status: 200, request: current } };
        });
        return outcome.status === 200 ? respond(res, 200, { request: outcome.request })
          : respond(res, outcome.status, { error: outcome.error });
      }
      if ((path === '/api/driver/overview' && req.method === 'GET') ||
          (path === '/api/driver/vehicles' && ['GET','POST'].includes(req.method))) {
        const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
        if (!token) return respond(res,401,{error:'Authentication required.'});
        const db = await store.read();
        const session = db.sessions.find(s=>s.tokenHash===tokenDigest(token)&&Date.parse(s.expiresAt)>now());
        const user = session && db.users.find(u=>u.id===session.userId);
        if (!user) return respond(res,401,{error:'Session expired.'});
        if (user.role !== 'driver') return respond(res,403,{error:'Driver access required.'});
        if (req.method === 'GET') {
          const vehicles=(db.vehicles??[]).filter(v=>v.driverId===user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
          if (path.endsWith('overview')) return respond(res,200,{user:publicUser(user),summary:{totalVehicles:vehicles.length},vehicles});
          return respond(res,200,{vehicles});
        }
        const data=await bodyJson(req);
        const {fields,clean}=validateVehicle(data);
        if (Object.keys(fields).length) return respond(res,400,{error:'Check the vehicle fields.',fields});
        const result=await store.transaction(db2=>{
          db2.vehicles??=[];
          if(db2.vehicles.some(v=>v.registrationPlate===clean.registrationPlate)) return {value:null};
          const vehicle=createVehicle(clean,user.id,now());
          db2.vehicles.push(vehicle);
          return {write:true,value:vehicle};
        });
        return result ? respond(res,201,{vehicle:result}) : respond(res,409,{error:'Vehicle registration plate already exists.'});
      }

      const driverVehicleRoute = /^\/api\/driver\/vehicles\/([0-9a-f-]{36})\/(availability|eligibility)$/.exec(path);
      if ((path === '/api/driver/availability' && req.method === 'GET') ||
          (driverVehicleRoute && ((driverVehicleRoute[2] === 'availability' && req.method === 'POST') ||
            (driverVehicleRoute[2] === 'eligibility' && req.method === 'GET')))) {
        const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
        if (!token) return respond(res,401,{error:'Authentication required.'});
        const db = await store.read();
        const session=db.sessions.find(s=>s.tokenHash===tokenDigest(token)&&Date.parse(s.expiresAt)>now());
        const user=session&&db.users.find(u=>u.id===session.userId);
        if (!user) return respond(res,401,{error:'Session expired.'});
        if (user.role!=='driver') return respond(res,403,{error:'Driver access required.'});
        if (!driverVehicleRoute) {
          return respond(res,200,{availability:(db.availability??[]).filter(a=>a.driverId===user.id)});
        }
        const vehicle=(db.vehicles??[]).find(v=>v.id===driverVehicleRoute[1]&&v.driverId===user.id);
        if (!vehicle) return respond(res,404,{error:'Vehicle not found.'});
        if (driverVehicleRoute[2]==='eligibility') {
          const {fields,clean}=validateEligibilityQuery(new URL(req.url,'http://localhost').searchParams);
          if (Object.keys(fields).length) return respond(res,400,{error:'Check eligibility fields.',fields});
          const declaration=(db.availability??[]).find(a=>a.vehicleId===vehicle.id&&a.date===clean.date);
          return respond(res,200,{vehicleId:vehicle.id,...previewVehicleEligibility(vehicle,declaration,clean,now())});
        }
        const input=await bodyJson(req);
        const {fields,clean}=validateAvailability(input,now());
        if (Object.keys(fields).length) return respond(res,400,{error:'Check availability fields.',fields});
        const saved=await store.transaction(data=>{
          const owned=(data.vehicles??[]).some(v=>v.id===vehicle.id&&v.driverId===user.id);
          if (!owned) return {value:null};
          data.availability??=[];
          const existing=data.availability.find(a=>a.vehicleId===vehicle.id&&a.date===clean.date);
          const declaration={vehicleId:vehicle.id,driverId:user.id,...clean,updatedAt:new Date(now()).toISOString()};
          if (existing) Object.assign(existing,declaration);
          else data.availability.push(declaration);
          return {write:true,value:declaration};
        });
        return saved ? respond(res,200,{availability:saved}) : respond(res,404,{error:'Vehicle not found.'});
      }
      return respond(res, 404, { error: 'Not found.' });
    } catch (error) {
      if (error.status === 400 || error.status === 413) return respond(res, error.status, { error: error.message });
      console.error('API failure:', error);
      return respond(res, 503, { error: 'Service temporarily unavailable.' });
    }
  });
}
