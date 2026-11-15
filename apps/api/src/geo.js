/** Coordinates are always {latitude, longitude}; OSRM expects longitude,latitude. */
export function validateCoordinates(value) {
  const fields = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, fields: { latitude: 'Latitude is required.', longitude: 'Longitude is required.' }, point: null };
  }
  if (typeof value.latitude !== 'number' || !Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90)
    fields.latitude = 'Latitude must be a finite number between -90 and 90.';
  if (typeof value.longitude !== 'number' || !Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180)
    fields.longitude = 'Longitude must be a finite number between -180 and 180.';
  return { valid: Object.keys(fields).length === 0, fields, point: Object.keys(fields).length ? null : { latitude: value.latitude, longitude: value.longitude } };
}

export function osrmCoordinate(value) {
  const checked = validateCoordinates(value);
  if (!checked.valid) throw new TypeError('Invalid geographic coordinates.');
  return `${checked.point.longitude},${checked.point.latitude}`;
}
