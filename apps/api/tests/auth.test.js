import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { JsonStore } from '../src/store.js';
import { validateRegistration } from '../src/auth.js';

test('registration validation disallows Admin and weak passwords', () => {
  assert.ok(validateRegistration({ name:'Jane', email:'j@x.com',password:'short',role:'admin' }).errors.role);
  assert.ok(validateRegistration({ name:'Jane', email:'j@x.com',password:'short',role:'farmer' }).errors.password);
});
test('register, reject duplicate/admin, login, session restore and logout', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'atpro-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'auth.json');
  const app = createApp({ store: new JsonStore(file) });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const base = 'http://127.0.0.1:' + app.address().port;
  async function call(path, method='GET', body, token) {
    const r = await fetch(base+path, { method, headers: { ...(body ? { 'Content-Type':'application/json' } : {}), ...(token ? { Authorization:'Bearer '+token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status:r.status, body:await r.json() };
  }
  const payload = { name:' Test Farmer ', email:'Farmer@Example.com', password:'a-strong-password-123',role:'farmer' };
  assert.equal((await call('/api/auth/me')).status,401);
  const registered=await call('/api/auth/register','POST',payload);
  assert.equal(registered.status,201);
  assert.equal(registered.body.user.email,'farmer@example.com');
  assert.equal(registered.body.user.role,'farmer');
  assert.equal(registered.body.user.passwordHash,undefined);
  assert.equal((await call('/api/auth/register','POST',payload)).status,409);
  assert.equal((await call('/api/auth/register','POST',{...payload,role:'admin',email:'a@b.com'})).status,400);
  const saved=JSON.parse(await readFile(file,'utf8'));
  assert.ok(saved.users[0].passwordHash && !JSON.stringify(saved).includes(payload.password));
  assert.equal((await call('/api/auth/login','POST',{email:payload.email,password:'incorrect'})).status,401);
  const login=await call('/api/auth/login','POST',{email:payload.email,password:payload.password});
  assert.equal(login.status,200);
  assert.ok(login.body.token.length>=43);
  assert.equal(login.body.user.role,'farmer');
  assert.equal((await call('/api/auth/me','GET',undefined,login.body.token)).status,200);
  assert.equal((await call('/api/auth/logout','POST',undefined,login.body.token)).status,200);
  assert.equal((await call('/api/auth/me','GET',undefined,login.body.token)).status,401);
  const driver=await call('/api/auth/register','POST',{...payload,email:'driver@example.com',role:'driver'});
  assert.equal(driver.status,201);
});
