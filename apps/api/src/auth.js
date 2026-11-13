import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const ROLE_SIGNUP = ['farmer', 'driver'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function normalizeEmail(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
export function validateRegistration(data) {
  const errors = {};
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  const email = normalizeEmail(data?.email);
  if (name.length < 2 || name.length > 100) errors.name = 'Name must contain 2–100 characters.';
  if (email.length > 254 || !emailPattern.test(email)) errors.email = 'Enter a valid email.';
  if (typeof data?.password !== 'string' || data.password.length < 12 || data.password.length > 128) errors.password = 'Use a password of 12–128 characters.';
  if (!ROLE_SIGNUP.includes(data?.role)) errors.role = 'Choose Farmer or Driver.';
  return { errors, clean: { name, email, role: data?.role } };
}
export async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return { salt, hash: hash.toString('hex') };
}
export async function passwordMatches(password, salt, expectedHex) {
  const result = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === result.length && timingSafeEqual(result, expected);
}
export function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }
export function newUser(data, hashed) { return { id: randomUUID(), ...data, passwordSalt: hashed.salt, passwordHash: hashed.hash, createdAt: new Date().toISOString() }; }
export function newToken() { return randomBytes(32).toString('base64url'); }
export function tokenDigest(token) { return createHash('sha256').update(token).digest('hex'); }
