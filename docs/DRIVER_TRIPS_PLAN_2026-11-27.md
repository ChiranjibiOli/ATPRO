# Driver Trips implementation plan — 2026-11-27

Baseline: 83fe035; CI successful; no open issues. Existing lifecycle POSTs must be reused.

## Slice 41: Driver trip list and detail
Role/goal: assigned Driver locates accepted, in-transit and completed trips. Fields: trip ID, market, date, vehicle, status, ordered assignments and minimum necessary pickup information. Actions: open Trips from dashboard, refresh, select trip, back. States: loading, empty, populated, retryable error, expired session, missing trip. No editable fields. Proposed GET /api/driver/trips and GET /api/driver/trips/:id; authenticate Driver and scope every query by driverId, return 404 for foreign IDs, explicitly whitelist response fields, never expose unrelated requests. Entities: trips, tripAssignments, requests, vehicles; no schema change. Acceptance: only own trips, deterministic assignment order, safe missing records, accessible native controls. Tests: 401/403/404, cross-driver isolation, response privacy, ordering, empty list, mobile client and navigation.

## Slice 42: native pickup and delivery controls
Role/goal: assigned Driver confirms physical collection and market delivery. Fields: read-only ordered assignments and status. Actions: confirm next pickup, confirm delivery after all pickups, cancel confirmation, retry/refresh. Reuse POST /api/driver/trips/:tripId/pickups/:requestId/confirm and POST /api/driver/trips/:tripId/deliver. Server remains authoritative; disable duplicate submissions, handle 401/403/404/409 and network uncertainty by refetching before retry. No optimistic success. Entities and state transitions as lifecycle plan; no schema change. Acceptance: confirmation required, correct next pickup, premature delivery unavailable, server errors visible, authoritative refresh. Tests: HTTP ownership, replay, ordering, premature delivery, concurrency, mobile state transitions, TypeScript and Expo Android export.

Update PAGE_SPEC, ARCHITECTURE and PROGRESS before implementation; run API/mobile tests, TypeScript and Android bundle before pushing implementation. No Vercel, no Admin registration, no changes to other repositories.
