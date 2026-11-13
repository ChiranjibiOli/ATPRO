import { nepalPickupAt } from './requests.js';
import { previewVehicleEligibility } from './availability.js';

const normalizeMarket = name => typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en') : '';
const nepalDateTime = iso => {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) return null;
  const local = new Date(instant + 345 * 60000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
};

/** Read-only candidate pool. Does not reserve a vehicle, approve it, or create a trip. */
export function previewRequestMatches(db, request, now = Date.now()) {
  const pickup = nepalDateTime(request.pickupAt);
  if (!pickup) throw new Error('Stored pickup instant is invalid');
  const marketKey = normalizeMarket(request.marketName);
  const groupRequests = (db.requests ?? []).filter(r =>
    r.status === 'pending' &&
    normalizeMarket(r.marketName) === marketKey &&
    nepalDateTime(r.pickupAt)?.date === pickup.date
  );
  const candidates = (db.vehicles ?? []).map(vehicle => {
    const declaration = (db.availability ?? []).find(a =>
      a.vehicleId === vehicle.id && a.driverId === vehicle.driverId && a.date === pickup.date
    );
    const basic = previewVehicleEligibility(vehicle, declaration,
      { date: pickup.date, time: pickup.time, weightKg: request.quantityKg }, now);
    const reasons = [...basic.reasons];
    if (request.handling === 'chilled' && vehicle.bodyType !== 'refrigerated')
      reasons.push('Chilled produce requires a refrigerated vehicle.');
    if (request.handling === 'fragile' && vehicle.bodyType === 'open')
      reasons.push('Fragile produce requires a covered or refrigerated vehicle.');
    if (!['standard', 'fragile', 'chilled'].includes(request.handling))
      reasons.push('Unsupported product handling requirement.');
    if (!['vegetable', 'fruit', 'grain', 'other'].includes(request.category))
      reasons.push('Unsupported product category.');
    return {
      vehicleId: vehicle.id, vehicleType: vehicle.vehicleType, bodyType: vehicle.bodyType,
      maximumWeightKg: vehicle.maximumWeightKg, eligible: reasons.length === 0, reasons,
    };
  });
  return {
    requestId: request.id,
    group: {
      marketName: request.marketName, pickupDate: pickup.date,
      pendingRequestCount: groupRequests.length,
      totalWeightKg: Number(groupRequests.reduce((sum, r) => sum + r.quantityKg, 0).toFixed(3)),
    },
    candidates,
    note: 'Read-only preliminary preview. No approval, reservation, route, volume, perishability, driver acceptance or booking is verified. Grouped requests may not all fit together.',
  };
}
