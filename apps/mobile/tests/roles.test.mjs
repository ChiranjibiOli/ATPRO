import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_DEFINITIONS, getRole, isRoleId } from '../src/domain/roles.ts';
import { ROLE_PREFERENCE_KEY, createRolePreferenceStore } from '../src/domain/preference.ts';

function mockStore(seed = []) {
  const data = new Map(seed);
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); },
    removeItem: async (key) => { data.delete(key); },
  };
}

test('exactly Farmer, Driver and Admin are available', () => {
  assert.deepEqual(ROLE_DEFINITIONS.map(r => r.id), ['farmer', 'driver', 'admin']);
  for (const role of ROLE_DEFINITIONS) {
    assert.ok(role.label && role.headline && role.summary);
    assert.equal(role.responsibilities.length, 3);
    assert.equal(getRole(role.id), role);
    assert.equal(isRoleId(role.id), true);
  }
});

test('rejects unknown and case-mismatched role IDs', () => {
  for (const invalid of ['', 'Farmer', 'manager', 'admin;true', null, undefined, 3, {}]) {
    assert.equal(isRoleId(invalid), false);
  }
});

test('loading returns null for a new visitor', async () => {
  const store = createRolePreferenceStore(mockStore());
  assert.equal(await store.load(), null);
});

test('selecting a role persists it across store instances', async () => {
  const storage = mockStore();
  const first = createRolePreferenceStore(storage);
  await first.save('driver');
  assert.equal(storage.data.get(ROLE_PREFERENCE_KEY), 'driver');
  assert.equal(await createRolePreferenceStore(storage).load(), 'driver');
});

test('changing role replaces previously saved role', async () => {
  const storage = mockStore();
  const store = createRolePreferenceStore(storage);
  await store.save('farmer');
  await store.save('admin');
  assert.equal(await store.load(), 'admin');
});

test('clear removes saved preference', async () => {
  const storage = mockStore();
  const store = createRolePreferenceStore(storage);
  await store.save('farmer');
  await store.clear();
  assert.equal(await store.load(), null);
});

test('malformed stored role is ignored without privilege escalation', async () => {
  const storage = mockStore([[ROLE_PREFERENCE_KEY, 'superadmin']]);
  assert.equal(await createRolePreferenceStore(storage).load(), null);
});

test('unknown role cannot be saved', async () => {
  const storage = mockStore();
  const store = createRolePreferenceStore(storage);
  await assert.rejects(() => store.save('root'), /Unsupported role/);
  assert.equal(storage.data.size, 0);
});

test('storage failures are exposed to the UI caller', async () => {
  const failing = {
    getItem: async () => { throw new Error('storage denied'); },
    setItem: async () => { throw new Error('storage denied'); },
    removeItem: async () => { throw new Error('storage denied'); },
  };
  const store = createRolePreferenceStore(failing);
  await assert.rejects(() => store.load(), /storage denied/);
  await assert.rejects(() => store.save('farmer'), /storage denied/);
  await assert.rejects(() => store.clear(), /storage denied/);
});
