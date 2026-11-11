import { randomUUID } from 'node:crypto';

const categories = new Set(['vegetable', 'fruit', 'grain', 'other']);
const handlingTypes = new Set(['standard', 'fragile', 'chilled']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const textField = (value, min, max) => typeof value === 'string' ? value.trim().length >= min && value.trim().length <= max : false;

/** Parse Nepal civil time without relying on the server's operating-system timezone. */
export function nepalPickupAt(date, time) {
  if (typeof date !== 'string' || !datePattern.test(date) || typeof time !== 'string' || !timePattern.test(time)) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (y < 2026 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  const [hour, minute] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - 345 * 60_000).toISOString();
}
export function validateTransportRequest(data, now = Date.now()) {
  const fields = {};
  if (!textField(data?.productName, 2, 80)) fields.productName = 'Product name must contain 2–80 characters.';
  if (!categories.has(data?.category)) fields.category = 'Select a supported product category.';
  if (!handlingTypes.has(data?.handling)) fields.handling = 'Select a handling requirement.';
  if (typeof data?.quantityKg !== 'number' || !Number.isFinite(data.quantityKg) || data.quantityKg <= 0 || data.quantityKg > 50000)
    fields.quantityKg = 'Weight must be greater than 0 and at most 50,000 kg.';
  if (!textField(data?.pickupAddress, 5, 200)) fields.pickupAddress = 'Pickup address must contain 5–200 characters.';
  if (!textField(data?.marketName, 3, 120)) fields.marketName = 'Market must contain 3–120 characters.';
  if (!Number.isInteger(data?.maxTransitHours) || data.maxTransitHours < 1 || data.maxTransitHours > 168)
    fields.maxTransitHours = 'Maximum transit time must be 1–168 whole hours.';
  const pickupAt = nepalPickupAt(data?.pickupDate, data?.pickupTime);
  if (!pickupAt) fields.pickupDate = 'Enter a real date (YYYY-MM-DD) and time (HH:mm) in Nepal time.';
  else if (Date.parse(pickupAt) <= now + 10 * 60_000 || Date.parse(pickupAt) > now + 365 * 24 * 60 * 60_000)
    fields.pickupDate = 'Pickup must be more than 10 minutes ahead and within 365 days.';
  return {
    fields,
    clean: {
      productName: typeof data?.productName === 'string' ? data.productName.trim() : '',
      category: data?.category,
      handling: data?.handling,
      quantityKg: data?.quantityKg,
      pickupAddress: typeof data?.pickupAddress === 'string' ? data.pickupAddress.trim() : '',
      marketName: typeof data?.marketName === 'string' ? data.marketName.trim() : '',
      pickupAt,
      maxTransitHours: data?.maxTransitHours,
    },
  };
}
export function createRequest(clean, farmerId, now = Date.now()) {
  return { id: randomUUID(), farmerId, ...clean, status: 'pending', revision: 1, createdAt: new Date(now).toISOString() };
}
