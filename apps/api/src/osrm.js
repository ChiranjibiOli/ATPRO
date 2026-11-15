import { osrmCoordinate } from './geo.js';

export class RoutingUnavailableError extends Error {
  constructor(message) { super(message); this.name = 'RoutingUnavailableError'; }
}

/** Backend-only OSRM table client. Never accept arbitrary URLs from a mobile request. */
export async function roadMatrix(points, { baseUrl = 'https://router.project-osrm.org', fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 25)
    throw new TypeError('A road matrix requires between 2 and 25 coordinates.');
  const coordinates = points.map(osrmCoordinate);
  let base;
  try { base = new URL(baseUrl); } catch { throw new TypeError('Invalid OSRM endpoint.'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash ||
      base.pathname !== '/' || !base.hostname || base.hostname === 'localhost' ||
      base.hostname.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(base.hostname))
    throw new TypeError('OSRM endpoint must be a trusted public HTTPS origin.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000)
    throw new TypeError('Invalid routing timeout.');
  const url = new URL('/table/v1/driving/' + coordinates.join(';'), base);
  url.searchParams.set('annotations', 'distance,duration');
  let response;
  try {
    response = await fetchImpl(url.toString(), { method: 'GET', signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
  } catch { throw new RoutingUnavailableError('Road routing service is unavailable or timed out.'); }
  if (!response?.ok) throw new RoutingUnavailableError('Road routing service returned an HTTP error.');
  let data;
  try { data = await response.json(); } catch { throw new RoutingUnavailableError('Road routing service returned invalid JSON.'); }
  if (data?.code !== 'Ok') throw new RoutingUnavailableError('No valid road network matrix is available.');
  const n = points.length;
  const validMatrix = matrix => Array.isArray(matrix) && matrix.length === n &&
    matrix.every(row => Array.isArray(row) && row.length === n &&
      row.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0));
  if (!validMatrix(data.distances) || !validMatrix(data.durations))
    throw new RoutingUnavailableError('Road matrix is incomplete or contains unreachable locations.');
  return { distancesMeters: data.distances, durationsSeconds: data.durations, pointCount: n,
    note: 'Road-network estimates only. No pickup order, vehicle allocation, perishability or booking has been confirmed.' };
}
