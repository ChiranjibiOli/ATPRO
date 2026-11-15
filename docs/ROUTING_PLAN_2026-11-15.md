# 2026-11-15 routing foundation plan (recorded before code)

Repository audit: main 6f0b0a9ce151c78a305079e6e9db57b5c11d5eec; 46 tracked files, latest GitHub Actions success; no open issues. Existing request, driver availability, compatibility and allocation code inspected. Neither validated coordinates nor OSRM exists. No duplicate features.

## Exactly two independently testable backend slices

### A. Explicit geographic coordinate validation
- Role/goal: Farmer/Driver data entry in future forms; validate GPS coordinates rather than guessing from text addresses.
- Inputs: `{latitude,longitude}` numeric decimal degrees; optional point absence is represented by null only at the future API boundary.
- UI: no new screen today; future forms require paired latitude/longitude fields with invalid/empty/loading/save states. Never silently geocode an address.
- Actions: parse and validate point, normalize longitude/latitude for routing; reject strings, NaN, Infinity, out-of-range values and partial coordinates.
- Authorization/storage: pure backend utility, no network or storage access; future authenticated Farmer/Driver endpoints must enforce ownership before persisting coordinates.
- API contract: `validateCoordinates(point)` returns `{valid,fields,point}`; `osrmCoordinate(point)` returns `longitude,latitude` or throws. Do not expose private coordinates through matching previews.
- Acceptance/tests: boundaries, zero, bad types, reversed order, missing fields, immutable output.

### B. OSRM road distance/time matrix adapter
- Role/goal: backend optimization engine obtains road network matrix for an explicit ordered set of validated coordinates; not yet a Farmer-facing route or booking.
- Inputs: 2–25 coordinates, injectable fetch and OSRM base URL; only a configured trusted HTTPS endpoint; no client-supplied URL.
- Actions: GET /table/v1/driving/{lon,lat;...}?annotations=distance,duration; validate response shape and all matrix entries; fail closed for null/unreachable pairs, timeouts and non-OK codes.
- UI: no new screen today; future route preview must show loading, unavailable, retry and no-route states. No fake road distance.
- Authorization/data: internal service only, no new public API or DB mutation; future route API must enforce owner/role and protect location data.
- Acceptance/tests: correct coordinate order, meters/seconds, asymmetric values preserved, unreachable and timeout failure, endpoint hardening, matrix dimensions.
- Limits: no paid routing, no route optimization or vehicle acceptance claimed. Public OSRM demo endpoint must not be treated as production SLA.

Verify Node API tests, existing mobile tests, TypeScript and Expo Android bundle via GitHub Actions. Only claim green after actual CI success. Next pair: authenticated coordinate persistence and mobile forms; then route preview with fixed Driver start and market end.
