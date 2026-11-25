# 2026-11-25: Driver trip lifecycle plan

Audit: main d7bbf83; CI successful; no open issues. Accepted trips and pending_pickup assignments exist in offers.js. No trip lifecycle implementation was found.

## Slice 1: Pickup confirmation
Role/goal: assigned Driver confirms collection. UI: future Driver Trips detail, ordered assignments, confirmation action; loading, empty, retry, conflict and expired-session states. No editable weight or ownership fields. Proposed API POST /api/driver/trips/:tripId/pickups/:requestId/confirm, authenticated Driver only. Validate UUIDs, trip ownership, accepted/in_transit state, assignment membership, earliest outstanding sequence, assigned request and duplicate confirmation. Atomically update assignment to picked_up, request to in_transit with revision increment, and trip to in_transit; server timestamp. Return sanitized trip/assignment; 401/403/404/409 as appropriate. Tests: ownership, ordering, duplicates, stale state, persistence and concurrent requests.

## Slice 2: Delivery confirmation
Role/goal: assigned Driver confirms delivery at the single market. UI: same trip detail, delivery confirmation enabled only after all pickups; loading/error/retry/conflict states. Proposed API POST /api/driver/trips/:tripId/deliver. Validate ownership, in_transit trip, nonempty assignments, all picked_up, matching request states, no prior delivery. Atomically mark assignments delivered, requests delivered with revisions, trip completed and server timestamp. Tests: premature/duplicate delivery, ownership, all-or-nothing updates, persistence and concurrency.

Architecture: reuse authenticated API and store mutation boundary; do not claim JSON storage provides multi-process transactions. No new role, market, booking or routing behavior. Acceptance: both transitions tested through API, full CI green, no unauthorized data exposure. Mobile UI integration may require a separate pair of slices.
