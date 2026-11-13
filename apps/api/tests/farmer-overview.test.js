import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { JsonStore } from '../src/store.js';

test('Farmer overview rejects unauthenticated/driver and scopes counts by owner', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'atpro-rbac-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new JsonStore(join(dir, 'db.json'));
  const app = createApp({ store });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const base = 'http://127.0.0.1:' + app.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const response = await fetch(base + path, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  const register = async (email, role) => {
    const r = await call('/api/auth/register', 'POST', {
      name: 'Test Account', email, password: 'valid-password-123', role,
    });
    assert.equal(r.status, 201);
    return r.body.user;
  };
  const login = async email => {
    const r = await call('/api/auth/login', 'POST', { email, password: 'valid-password-123' });
    assert.equal(r.status, 200);
    return r.body.token;
  };
  const alice = await register('alice@example.com', 'farmer');
  const bob = await register('bob@example.com', 'farmer');
  await register('driver@example.com', 'driver');
  const aliceToken = await login('alice@example.com');
  const bobToken = await login('bob@example.com');
  const driverToken = await login('driver@example.com');
  assert.equal((await call('/api/farmer/overview')).status, 401);
  assert.equal((await call('/api/farmer/overview', 'GET', undefined, 'invalid')).status, 401);
  assert.equal((await call('/api/farmer/overview', 'GET', undefined, driverToken)).status, 403);
  const empty = await call('/api/farmer/overview', 'GET', undefined, aliceToken);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.summary, { totalRequests: 0, pendingRequests: 0, activeTrips: 0 });
  await store.transaction(db => {
    db.requests = [
      { id: 'r1', farmerId: alice.id, status: 'pending' },
      { id: 'r2', farmerId: alice.id, status: 'assigned' },
      { id: 'r3', farmerId: bob.id, status: 'pending' },
    ];
    db.trips = [
      { id: 't1', status: 'accepted' }, { id: 't2', status: 'in_transit' },
    ];
    db.tripAssignments = [
      { tripId: 't1', requestId: 'r2' }, { tripId: 't2', requestId: 'r3' },
    ];
    return { write: true };
  });
  const a = await call('/api/farmer/overview', 'GET', undefined, aliceToken);
  assert.equal(a.status, 200);
  assert.deepEqual(a.body.summary, { totalRequests: 2, pendingRequests: 1, activeTrips: 1 });
  const b = await call('/api/farmer/overview', 'GET', undefined, bobToken);
  assert.deepEqual(b.body.summary, { totalRequests: 1, pendingRequests: 1, activeTrips: 1 });
  assert.equal(a.body.user.id, alice.id);
  assert.equal(a.body.user.passwordHash, undefined);
  await call('/api/auth/logout', 'POST', undefined, aliceToken);
  assert.equal((await call('/api/farmer/overview', 'GET', undefined, aliceToken)).status, 401);
});
