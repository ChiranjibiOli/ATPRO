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
    allocation: previewGroupAllocation(db, groupRequests, db.vehicles ?? [], now),
    note: 'Read-only preliminary preview. No approval, reservation, route, volume, perishability, driver acceptance or booking is verified. Grouped requests may not all fit together.',
  };
}

/** Deterministic, read-only, first-fit-decreasing capacity proposal.
 * Each request is indivisible. Vehicle/time/product checks apply per request.
 * Integer grams prevent floating-point capacity oversubscription.
 */
export function previewGroupAllocation(db, requests, vehicles, now = Date.now()) {
  const ordered = [...requests].filter(r => Number.isFinite(r.quantityKg) && r.quantityKg > 0)
    .sort((a,b) => b.quantityKg - a.quantityKg || a.id.localeCompare(b.id));
  const bins = [...vehicles].sort((a,b) => a.id.localeCompare(b.id)).map(vehicle => ({
    vehicle,
    capacityGrams: Math.floor(vehicle.maximumWeightKg * 1000 + 1e-7),
    usedGrams: 0,
    count: 0,
  }));
  let assignedGrams = 0;
  let assignedRequestCount = 0;
  for (const request of ordered) {
    const pickup = nepalDateTime(request.pickupAt);
    if (!pickup) continue;
    const grams = Math.ceil(request.quantityKg * 1000 - 1e-7);
    if (!Number.isSafeInteger(grams) || grams <= 0) continue;
    for (const bin of bins) {
      if (grams > bin.capacityGrams - bin.usedGrams) continue;
      const declaration = (db.availability ?? []).find(a =>
        a.vehicleId === bin.vehicle.id && a.driverId === bin.vehicle.driverId && a.date === pickup.date);
      const basic = previewVehicleEligibility(bin.vehicle, declaration,
        { date: pickup.date, time: pickup.time, weightKg: request.quantityKg }, now);
      if (!basic.eligible) continue;
      if (request.handling === 'chilled' && bin.vehicle.bodyType !== 'refrigerated') continue;
      if (request.handling === 'fragile' && bin.vehicle.bodyType === 'open') continue;
      if (!['standard','fragile','chilled'].includes(request.handling) ||
          !['vegetable','fruit','grain','other'].includes(request.category)) continue;
      bin.usedGrams += grams;
      bin.count++;
      assignedGrams += grams;
      assignedRequestCount++;
      break;
    }
  }
  const totalGrams = ordered.reduce((sum,r) => sum + Math.ceil(r.quantityKg * 1000 - 1e-7),0);
  return {
    assignedRequestCount,
    unassignedRequestCount: requests.length - assignedRequestCount,
    assignedWeightKg: assignedGrams / 1000,
    unassignedWeightKg: Math.max(0, totalGrams - assignedGrams) / 1000,
    vehicles: bins.filter(b => b.count > 0).map(b => ({
      vehicleId: b.vehicle.id,
      allocatedRequestCount: b.count,
      allocatedWeightKg: b.usedGrams / 1000,
      remainingWeightKg: (b.capacityGrams - b.usedGrams) / 1000,
    })),
    note: 'Provisional first-fit weight allocation only. No capacity is reserved. Road travel, time windows along a route, perishability, volume, driver approval/acceptance and bookings are not verified.',
  };
}
