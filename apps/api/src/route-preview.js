import { validateCoordinates } from './geo.js';
import { previewRequestMatches } from './matching.js';

/** A single Farmer's fixed-endpoint, read-only road preview; no other Farmer locations are exposed. */
export function routeReadiness(db, request, { vehicleId = null, now = Date.now() } = {}) {
  const matches = previewRequestMatches(db, request, now);
  const reasons = [];
  if (!validateCoordinates(request.pickupCoordinates).valid) reasons.push('missing_pickup_coordinates');
  if (!validateCoordinates(request.marketCoordinates).valid) reasons.push('missing_market_coordinates');
  const eligible = matches.candidates.filter(candidate => candidate.eligible)
    .sort((a, b) => a.vehicleId.localeCompare(b.vehicleId));
  const selected = vehicleId ? eligible.find(v => v.vehicleId === vehicleId) : eligible[0];
  if (!selected) reasons.push(vehicleId ? 'vehicle_not_eligible' : 'no_eligible_vehicle');
  const pickupDate = matches.group.pickupDate;
  const declaration = selected && (db.availability ?? []).find(a =>
    a.vehicleId === selected.vehicleId && a.date === pickupDate);
  if (selected && !validateCoordinates(declaration?.startCoordinates).valid)
    reasons.push('missing_driver_start_coordinates');
  return {
    ready: reasons.length === 0,
    reasons,
    vehicleId: selected?.vehicleId ?? null,
    vehicleType: selected?.vehicleType ?? null,
    points: reasons.length ? null : [declaration.startCoordinates, request.pickupCoordinates, request.marketCoordinates],
  };
}

/** Read only the two directed legs D -> pickup -> market; do not leak a full location matrix. */
export function summarizeRoadMatrix(matrix, vehicleId, vehicleType) {
  const distances = matrix?.distancesMeters, durations = matrix?.durationsSeconds;
  const valid = values => Array.isArray(values) && values.length === 3 &&
    values.every(row => Array.isArray(row) && row.length === 3) &&
    [values[0][1], values[1][2]].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  if (!valid(distances) || !valid(durations)) throw new TypeError('Invalid road matrix.');
  return {
    vehicleId, vehicleType,
    legs: [
      { from: 'driver_start', to: 'farmer_pickup', distanceMeters: distances[0][1], durationSeconds: durations[0][1] },
      { from: 'farmer_pickup', to: 'destination_market', distanceMeters: distances[1][2], durationSeconds: durations[1][2] },
    ],
    totalDistanceMeters: distances[0][1] + distances[1][2],
    totalDurationSeconds: durations[0][1] + durations[1][2],
    note: 'Single-request road estimate only. No multiple pickup route, perishability guarantee, reservation, driver acceptance or booking.',
  };
}
