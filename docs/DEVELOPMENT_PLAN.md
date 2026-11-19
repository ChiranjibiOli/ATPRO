# ATPRO Incremental Development Plan

Date: 2026-11-05. Each daily iteration starts by checking the true repository tree, recent commits, tests and issues. Never duplicate existing functionality. Define screens and APIs before implementation, then test and publish verified changes.

## Initial repository audit

The only source previously present was a README in the main branch, commit 6eb871ddd58b584ab1c93077c6179f58af410f2c. Earlier downloadable web-prototype packages had not been pushed. This iteration starts the actual Android-first Expo codebase.

## Current pair: landing + role exploration

Feature A: public landing page describing system purpose, real-world crop transport problems and the planned request → match → pickup route → driver acceptance flow. Functional navigation opens roles.

Feature B: public Farmer/Driver/Admin exploration and optional stored preference with change, clear and validation. The preference must never authorize a protected action.

Done when the UI has accessible touch controls, explicit loading/error/empty states, an accurate prototype disclosure, and test coverage for persisted role values.

## Next increments

1. Registration + login: secure API-backed identity, Farmer/Driver sign-up, admin provisioning, server-issued roles, password hashing, throttling.
2. Route-level RBAC + Farmer dashboard: authentic session from backend, real request summaries with empty/loading/errors.
3. Farmer create request + storage: product, kg/volume, location, market and time windows.
4. Request list + edit/cancel rules, including owner and state validation.
5. Driver dashboard + vehicle creation; then availability and current capacity.
6. Compatible matching + market/date grouping; atomic assignment.
7. OSRM distance/time matrix + adapted Clarke-Wright routes.
8. Fixed-endpoint 2-opt + route feasibility/perishability limits.
9. Driver accept/reject + booking lifecycle; pickup and delivery confirmation.
10. Cost allocation + Admin monitoring/audit dashboard.

Change this sequence based on prior completed features and dependency gaps. Two *small, connected, testable features* are better than incomplete giant features.

## Definition of done

- For each page: role, goal, fields, actions, constraints, authorization, entity/API flow, UI states, tests and acceptance conditions defined.
- User can perform every advertised action. No dead buttons or fake metrics.
- Tests pass and app is integrated with prior code.
- Commit and push verified to ChiranjibiOli/ATPRO only.
- Report exact commit link, tests, feature scope, blockers, and mobile preview instructions or verified live URL.

## 2026-11-06 selected pair

Repository audit confirms landing/roles are complete and CI green. Implement only registration and login (including /me and logout as the login vertical slice). First write server authentication and tests, then connect Expo mobile forms and session restoration. No Farmer dashboard or request APIs in this increment. Verify npm tests, TypeScript and Android Expo export via GitHub Actions; publish only verified commit. Document lack of public live preview until backend deployment.

## 2026-11-07 selected pair (plan recorded before code)

Audit: head fe8b19e2fb5c052f492a1fd81e26b59c038db133; mobile landing, roles, registration, login and account already exist. Latest GitHub CI 42232630276 passed. No open issues. Implement exactly:
A. Shared server authentication/role guard, exercised by GET /api/farmer/overview (401 missing/expired token, 403 authenticated non-Farmer). No client preference can grant privileges. Avoid public Admin registration.
B. Farmer-only mobile dashboard reached after authenticated Farmer login, showing real server-backed account identity and actual request/trip counts from persisted collections (empty if no records), with loading/retry/offline states and logout. Driver/Admin retain the existing account screen.

Acceptance: 401/403/200 integration tests; zero counts with empty store, own records only with cross-farmer fixtures; mobile TS typecheck and Expo Android export; no invented requests or fake navigation. No new request creation until the following iteration. JSON prototype persistence remains single-process only.

## 2026-11-08 selected pair (recorded before implementation)
Audit: main head 717e0d1bf793884689b1d67d14a9ed0fd529fe33, CI 42376669161 passed all API/mobile/TypeScript/Android export checks, no open issues. Existing Farmer overview and auth remain unchanged except necessary integration. Two vertical slices only:
1. Farmer request API and durable JSON storage: POST /api/farmer/requests validates authenticated Farmer, productName, category (vegetable/fruit/grain/other), handling (standard/fragile/chilled), quantityKg >0, pickupAddress, marketName, pickupDate YYYY-MM-DD, pickupTime HH:mm in Nepal local time, maxTransitHours 1–168. Persist id, farmerId from session, status=pending, createdAt, pickupAt ISO. GET /api/farmer/requests returns own records only, newest first. Explicit 400 fields, 401, 403, 413, 503; JSON single-process prototype. No assignment, matching or acceptance yet.
2. Mobile Farmer request form wired to POST and dashboard: authenticated Farmer opens Create request, enters required fields, sees field errors/loading/retry; success returns to dashboard, reloads real counts and shows persisted own requests via GET. No Driver/Admin access, fake vehicle offers or navigation dead ends. Test backend owner isolation, invalid inputs, persistence/restart, role/session and response shape; GitHub CI tests, TypeScript and Android JS export.
Production note: this is a functional single-process local prototype, not a PostgreSQL-backed deployed service. No user-edit/cancel in this pair.

## 2026-11-09 selected pair (recorded before implementation)
Repository audit: main 1591c84cdcaedc837322e4d21171887032701f1b, CI 42485158070 green, zero open issues. Existing registration/login, Farmer dashboard, request creation/list are present; skip them.
A. Farmer request detail and edit: authenticated GET /api/farmer/requests/:id and PATCH /api/farmer/requests/:id; ownership enforced; edit pending only; reuse validated request input; require optimistic revision to avoid overwriting concurrent edits; show a detail page with full fields, edit action and validation/loading/error states.
B. Farmer cancellation: POST /api/farmer/requests/:id/cancel; pending-only, idempotency explicitly handled as 409 for already cancelled; authenticated owner only; confirm cancellation in mobile detail page, refresh dashboard; preserve record and status for audit.
Acceptance: 401 missing/expired, 403 driver, 404 other Farmer, 409 stale/assigned/cancelled, 400 invalid input, 200 valid mutation; data survives JSON restart; mobile TS and Android export; no new role or fabricated trip.

## 2026-11-11 selected pair (plan recorded before code)
HEAD 7f64d5093ddda58b1a00a8295040d5ab99802ea3, latest CI green, no open issues. Source tree audit confirms Farmer create/list and Driver dashboard/registration are present but Farmer detail/edit/cancel were lost. First restore authenticated GET/PATCH request detail with revision conflict and prefilled mobile form. Second restore pending-only cancellation with explicit UI confirmation, persisted status, dashboard refresh and tests. Preserve all other code. Run API and mobile tests, TypeScript and Expo Android export; do not claim APK or public preview.

## 2026-11-11 implementation follow-up
Two previously missing Farmer lifecycle slices restored: request details/edit with owner-scoped GET/PATCH and optimistic revision, plus pending-only cancellation with confirmation and durable retained status. Driver availability and capacity remain the next two features; do not rebuild Farmer request creation, registration or Driver vehicle registration. Require API tests, mobile tests, TypeScript and Expo Android export before declaring verified.

## 2026-11-12 selected pair (recorded before implementation)
Repository audit: main 7d234d3923c533d6702be76cf8556dfb84a78e9f; previous GitHub Actions green; zero open issues. Verified existing Driver dashboard and vehicle registration, Farmer lifecycle, auth and docs. Skip those completed features.
1. Driver availability declaration (vertical slice): authenticated Driver selects one owned vehicle, Nepal-local available date and start/end time, and declared starting location (address, not live GPS). POST /api/driver/vehicles/:id/availability replaces that vehicle's declared future availability; GET /api/driver/availability lists own records. Validate date, time, start before end, future end, address length, vehicle ownership, and reject other users/roles. Mobile screen linked from Driver dashboard with loading, validation, save, retry, back and no-vehicles state. Records persist in local JSON, owner derived from session. Tests for ownership, invalid data, replacement, persistence and expired sessions.
2. Capacity and availability eligibility preview (vertical slice): GET /api/driver/vehicles/:id/eligibility?date=YYYY-MM-DD&time=HH:mm&weightKg=N. Return explicit eligible boolean and reasons based on owned vehicle's weight limit, registered status, and declared available window. This is a *preliminary driver-only check*, not a matching offer: no product compatibility, perishability, route optimization, volume or booking until those inputs exist. Mobile Driver screen lets driver enter target date/time/weight, inspect actual API result and reasons, with loading/error/empty states. Tests for boundary times, overweight, missing availability, unauthorized access, invalid query, and persistence.
Acceptance: both slices integrated into existing Driver account without dead controls, no fourth role, no fake bookings, no paid service. API tests + mobile tests + TypeScript + Expo Android JS bundle via CI. Production JSON store and non-HTTPS local API remain explicitly development-only.

## 2026-11-13 selected pair (recorded before implementation)

Audit: HEAD bc5c0ae966cbab9c7e5815fa0ac4332004157386, latest GitHub CI green for all three recent commits, no open issues. Existing auth, Farmer request lifecycle, Driver vehicles, declared availability and preliminary weight/time eligibility are present; do not rebuild.

**Slice 17: request-to-vehicle handling compatibility.** Farmer goal: inspect whether vehicles can handle the saved crop. Inputs: existing Farmer-owned request category, handling, weight and existing Driver vehicle body/type/status and declaration. Action: open request's matching preview. No editable fields in preview. Backend checks category/handling and vehicle body: chilled requires refrigerated; fragile requires covered or refrigerated; standard allows all, but open vehicles cannot be used for fragile/chilled. Registered is NOT approved: do not label results bookable. Farmer-only authorization and ownership; GET /api/farmer/requests/:id/matches returns 401/403/404, 200 with eligible candidates/reasons. Loading, empty, error and retry in existing request detail screen. Tests: chilled/open rejection, fragile/covered acceptance, overweight, no availability, role/owner isolation. No driver personal contact information returned.

**Slice 18: same-market/date grouping preview.** Farmer goal: inspect other pending requests for same normalized market and Nepal calendar date, without revealing other farmers' private pickup details. Same endpoint returns own request plus anonymized group summary (number of pending requests, total kg) for exact normalized market/date. Grouping is only a *candidate pool*, not a trip, capacity reservation, booking, acceptance or routing. Time/weight checks still apply per candidate; do not assume all grouped requests can share a vehicle. Server derives market/date from stored requests, never trusts query parameters. UI shows group counts and explicit provisional warning. Tests: market normalization, same-date boundary, cancelled exclusion, other-market exclusion, cross-farmer privacy, request ownership, empty state. No new DB tables: derived read-only from requests/vehicles/availability.

Acceptance: both slices share a single Farmer-owned read-only preview, use real records, no fake vehicle offers, and preserve three roles. Validate API tests, mobile tests, TypeScript and Expo Android export in CI. Do not claim physical Android/hosted preview. Next pair: atomic capacity allocation and OSRM matrix groundwork.

## 2026-11-14 planned next development

Existing Farmer compatibility/grouping preview is extended with two independently testable slices: (1) deterministic read-only group payload allocation in the existing API; (2) integrated Farmer request detail UI for provisional assigned/unassigned kg and vehicle remaining capacity. Maintain server-only ownership/role checks, stable capacity arithmetic, clear nonbinding status and no fake booking controls. Future pair: location coordinates and OSRM road matrix before Clarke-Wright. Tests: API allocation invariants, mobile TS, Android JS bundle.

## 2026-11-16 — coordinate capture pair (plan recorded before implementation)
Audit: main 28851e7bf0077f0378536d5b05602d300a02a185; latest CI 43720154825 passed; zero open issues. geo.js and osrm.js exist, but no persisted request/availability coordinates or mobile inputs. Two connected, independently testable vertical slices:
1. Farmer request pickup + destination-market coordinates: optional paired numeric latitude/longitude for each location, validated server-side with geo.js. On create/edit persist on owner-scoped request; edit keeps revision/ownership/pending guards; existing address-only requests remain valid. UI adds clearly labeled optional coordinate pairs with client error/empty/loading handling and prefilled edit values. No geocoding from free text or third-party calls. API POST/PATCH /api/farmer/requests, existing GET owner-scoped; reject partial/malformed coordinates (400). Test boundaries, persistence, legacy compatibility, access control, revision conflicts.
2. Driver declared starting coordinates: optional paired numeric latitude/longitude in availability declaration; validate, save/replace for owned vehicle/date, display stored values in Driver availability UI. Existing text-only availability remains valid; API POST /api/driver/vehicles/:id/availability and GET /api/driver/availability. Test partial/out-of-range inputs, ownership, role, replacement and persistence.
Both use {latitude,longitude} decimal degrees, never assume address text equals verified GPS. No automatic geocoding, route generation, location sharing with other Farmers, bookings or GPS permission. Forms show errors and retry, preserve entries on network failure. CI gate: all API/mobile tests, TypeScript, Expo Android JS export. Physical Android and public backend remain unverified.

## 2026-11-17 — Route readiness and road matrix preview (plan recorded before code)

Audit: main 4cfe7d965381a12314ce7cd18b0c1af39c1b2c8d, CI 43883460336 passed, zero open issues. Existing geo.js coordinate validation, osrm.js roadMatrix, Farmer/Driver coordinate storage, matching and capacity previews verified in tree. No integrated road preview API or route readiness check exists. Preserve all existing flows and the unrelated e-selling repository.

### Slice 25: Farmer-owned route readiness API
Role/goal: authenticated Farmer inspects whether their pending request has enough coordinate data to preview a driver-to-market road route. No new input form; coordinates come from existing Farmer request and Driver availability forms. Data: request, same-market/same-Nepal-date pending pool, eligible vehicles and availability. API: GET /api/farmer/requests/:id/route-preview. Verify token, Farmer role and request ownership (401/403/404); nonpending returns 409. Respond with ready=false and machine-readable reason codes for missing pickup/market/start coordinates or no eligible available vehicle, without leaking other Farmers' addresses, coordinates, IDs or Driver start coordinates. Empty and error states are explicit; never synthesize coordinates from address text. Acceptance: readiness accurately reflects persisted data and eligibility, with one market and fixed Driver start/market end. Tests: missing coordinates, authorization, no eligible vehicle, valid complete inputs, privacy.

### Slice 26: OSRM-backed road matrix preview API
Role/goal: same Farmer receives read-only road distance/duration preview for an eligible vehicle and their own pickup, not a booked route or optimization. Input: optional vehicleId query (UUID), otherwise deterministic first eligible candidate; validate query, never accept arbitrary URL or coordinates. API: same GET endpoint; output only selected vehicle ID/type and aggregate road distance/time from fixed Driver start -> own pickup -> own destination market; no other Farmers' private locations or raw matrix. Backend: inject trusted roadMatrix dependency for tests, call existing OSRM helper with 3 stored validated coordinates, compute two directed legs and totals; handle timeout/unreachable/invalid matrix with 503 and safe message. Do not claim Clarke-Wright, 2-opt, multiple pickup route or perishability feasibility. States: not-ready, ready, routing-service error; mobile UI integration may be deferred to a separate slice. Acceptance: directed leg indices 0->1 and 1->2, no straight-line fallback, fixed endpoints, no data mutation. Tests: deterministic selection, invalid vehicleId, directed matrix, 503, no mutation.

Verification gate: API tests, mobile tests, TypeScript check, Expo Android JS bundle on GitHub Actions. No live OSRM claim without actual request. Next: native Farmer route preview screen and multi-pickup Clarke-Wright with constraints.


## 2026-11-18 — Native route preview pair (recorded before implementation)

Audit: main b7cfbd332b057ee7c52ad5f4ddabfef69b9d685c, latest CI 44097132951 successful, zero open issues. The existing Farmer-owned GET /api/farmer/requests/:id/route-preview already implements readiness and directed OSRM legs, but RequestDetailScreen and mobile client have no integration. Do not redo backend routing or claim Clarke-Wright until a multi-request constraint-aware design is ready.

**Slice 27: typed mobile route preview API client.** Farmer goal: request a road preview for their own pending request. Fields: existing request ID and optional selected eligible vehicle ID; no arbitrary URLs or coordinates. Action: fetch protected GET /api/farmer/requests/:id/route-preview using SecureStore-restored bearer token. Contract: discriminated union ready:false {reasons,vehicleId} or ready:true {vehicleId,vehicleType,legs,totalDistanceMeters,totalDurationSeconds,note}. Authorization enforced by existing backend, 401 expired session, 403 wrong role, 404 ownership, 409 nonpending, 429 limit, 503 unavailable. No database changes. Acceptance: no client-side invented distances, typed server result and safe encoding of ID; TypeScript check and Android export.

**Slice 28: native Farmer route preview UI.** Farmer goal: inspect single-request Driver start → own pickup → one market estimate from RequestDetailScreen. Fields: none editable; existing request fields and route readiness reasons. Actions: explicit 'Preview road route' and retry, return to request details, edit/cancel existing request. UI: idle, loading, not-ready with reason descriptions, success with two directed legs in km/min and total, API/network error with retry, session-expired navigation. Existing match preview remains separate; do not show other Farmers' locations or claim a multi-stop optimized route. Accessibility: leg labels as readable text, button states prevent double submission. Tests: API existing integration tests plus mobile TypeScript/Expo Android JS export, and route preview display formatting tests where feasible. No new entities, no mutation or bookings.

Next after this pair: multi-Farmer open-route Clarke-Wright adaptation with explicit start/end and deterministic matrix fixtures, then constraint-aware 2-opt.


## 2026-11-19 selected pair and scope
Audit: 3d646a38d3879167b14d0e11e34bd3c6dcdc77a8, CI green, zero open issues. Two independently testable backend domain slices only: directed Clarke-Wright-inspired open-route merging and fixed-endpoint constraint-aware 2-opt. Detailed pre-code specification committed at docs/OPTIMIZATION_PLAN_2026-11-19.md. Role: future Farmer preview / Driver acceptance, but no new UI or public API in this pair. Input fields, validation, authorization boundary, error states, entities, algorithms and acceptance tests are defined there and in PAGE_SPEC.md. Implementation: apps/api/src/optimization.js; tests: apps/api/tests/optimization.test.js. No database changes. Next: authenticated same-market/date multi-request orchestration; native read-only multi-pickup preview. Verify latest CI before marking completed.
