# ATPRO Screen and Feature Specifications

Built items refer to implemented code, not an independently confirmed Android runtime build.

## Built: Landing Screen

- User and goal: Public visitor, learn how the transport workflow is planned to operate.
- Fields: None. Shows system description and three stages: Farmer request, vehicle matching, feasible routing and driver acceptance.
- Actions: Explore user roles button navigates into the role selection screen.
- Validation: Navigation destination exists; no form values.
- Authorization: Public, no account or privilege.
- Data: Static explanatory content. API: no network request.
- UI states: Scrollable responsive layout and prototype disclosure; no false booking metrics.
- Acceptance: On-device navigation moves to role screen without blank/dead controls.
- Verification: Source review; actual Expo Go device navigation remains to be checked.

## Built: Role Exploration Screen

- User and goal: Any visitor may explore Farmer, Driver or Admin responsibilities.
- Fields: One optional choice from exact IDs farmer, driver, admin.
- Actions: Tap role, see its specific tasks, clear preference, return home.
- Validation: Reject unknown or corrupted preference values. Three roles only.
- Authorization: Public browsing preference, NOT authentication or permissions.
- Data: Local unencrypted key-value preference under atpro.public.role.v1; no personal account details.
- API/storage flow: getItem on launch, setItem when selected, removeItem on clearing. Save operations serialized. No backend requests.
- UI states: Initial loading, no selection, selected role details, storage-failure warning.
- Acceptance: Restore value on restart, replace on reselect, clear, ignore invalid saved data, no privilege escalation.
- Tests: Automated role allowlist, role metadata, persistence adapter, replacement, clear, corruption and storage errors.

## Planned: Register + Login

- Roles: Unauthenticated Farmer and Driver may register; Admin account is securely provisioned only. Existing users of all three roles may log in.
- Register fields: name, verified or normalized contact identifier (phone or email per finalized local policy), password, confirmation, terms approval and Farmer/Driver selection.
- Register actions: Submit, correct errors, continue to login.
- Validation: Required fields, duplicate identifier, strong password, allowlisted role, accepted terms, server-side throttling.
- API: POST /api/auth/register. Data: Users and audit events. Store salted password hashes, never raw password.
- Login fields: identifier, password; submit, logout and expired-session handling.
- API: POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout. Server, not preference storage, defines role.
- State: idle, validating, loading, success, invalid credentials, rate-limited, network failure, expired session.
- Acceptance: Cannot self-register as Admin, cannot access another user's records, logout revokes access.

## Planned: Farmer

### Dashboard
- Goal: View own active requests, upcoming trips and genuine status counts.
- Data: Authenticated user's requests and assignments. APIs: GET /api/farmer/overview.
- States: loading, empty, error, populated. Action: create request, inspect request.
- Security: Server filters by authenticated farmer ID.

### New transportation request
- Fields: crop taxonomy/product, handling category, positive kg, optional volume, origin address or coordinates, market, pickup date/time window, delivery time requirement, notes.
- Actions: Review and submit. API: POST /api/requests. Data: requests and products.
- Rules: Product compatibility, real locations, eligible date and market; never accept invalid amount or another owner ID.
- States: validation errors, submit, success, failed network, duplicate warning, unsupported product.
- Acceptance: Saved request appears in farmer's requests; invalid requests are rejected by server.

### My requests
- Goal: List/filter/detail/edit/cancel own requests. APIs: GET /api/requests, PATCH /api/requests/:id, POST /api/requests/:id/cancel.
- Data: request and assignment state; versioning prevents stale edits after dispatch.
- States: empty, paginated, error, stale conflict, cancellation restrictions.

### Compatible vehicles and trip tracking
- Goal: Show only feasible vehicle offers, select a proposal; driver must accept before booking is confirmed.
- Rules: Weight, product pairing, perishability, vehicle type and time window. Support unassigned requests rather than disappearing them.
- APIs: GET /api/requests/:id/offers, POST /api/offers/:id/request; GET /api/farmer/trips/:id.
- States: no eligible vehicle, pending driver response, acceptance, rejection, expired, pickup and delivery progress.

## Planned: Driver

### Dashboard and vehicle management
- Driver dashboard lists real offers, vehicles and trips; empty states when none.
- Vehicle fields: registration plate, vehicle category (bike, mini-truck, truck), covered/open/refrigerated capability, maximum kg and optional volume; ownership and approval status.
- APIs: GET /api/driver/overview, GET/POST/PATCH /api/vehicles.
- Validation: Positive capacity, eligible vehicle body, duplicate plate and ownership, active-trip conflicts.

### Availability and start location
- Fields: vehicle, available date/time window, declared starting coordinates/address (no required fixed city), optionally preferred working regions later.
- APIs: GET/POST/PATCH /api/driver/availability.
- The first accepted market/date trip commits capacity for that trip only, not all future vehicle availability.

### Trip offers and active pickup route
- Driver accepts or declines a proposed trip; capacity booked transactionally.
- Route: current driver starting point → compatible farm pickups → ONE destination market.
- Pickup confirmations are per request, delivery only after valid pickup transitions.
- APIs: POST /api/offers/:id/accept or /decline, POST /api/trips/:id/pickups/:requestId/confirm, POST /api/trips/:id/deliver.
- States: pending, accepted, full capacity, conflict, in-transit, completed, cancellation/error.

## Planned: Admin

- Dashboard: Real, dated user, vehicle, request and trip status counts, no fabricated metrics.
- Management: review users, suspend/restore, vehicle approval, transport exception review and audit history.
- APIs: Authenticated /api/admin/* routes; roles enforced on server. Changes logged with actor, timestamp and reason.
- States: loading, empty, permission denied, successful audited action, conflict/error.

## Shared algorithmic acceptance

- Group by single market and compatible date/time window.
- Classify product handling, perishability and urgency; don't relax hard safety constraints for priority.
- Filter incompatible mixed loads and ineligible vehicle bodies, maximum weight and volume, driver time.
- Use road-distance/time matrix from OSRM; respect unreachable locations and service errors.
- Adapt Clarke-Wright because original savings assumes depot cycles, whereas ATPRO has arbitrary driver start D and fixed market M.
- Use feasible 2-opt to improve driver D → farmer stops → market M while keeping D and M fixed.
- Record unassigned requests; driver acceptance required; pickups/delivery confirmed with audit events.
- Calculate transparent cost allocations based on real recorded route and quantity. Do not claim paid transactions.

## 2026-11-06 implementation contract: registration and login

### Feature 3: Farmer/Driver registration
- Role/goal: unauthenticated Farmer or Driver creates a personal account; Admin cannot register.
- UI: full name, email, password, confirm password, Farmer/Driver radio selector; idle, loading, field errors, duplicate email, network error and success.
- Actions: select role, submit, navigate to login after success. No fabricated OTP verification.
- Validation: trimmed name 2–100 chars, lowercase valid email <=254, password 12–128 chars, confirmation equality, exact role allowlist; enforce on server as well.
- Auth: public endpoint POST /api/auth/register {name,email,password,role}; 201 {user:{id,name,email,role}}; 400 invalid, 409 duplicate, 429 rate limit, 503 storage unavailable. No user-supplied IDs or admin role.
- Entities: User {id,name,email,role,passwordSalt,passwordHash,createdAt}; sensitive hashes never returned.
- Persistence: backend serialized atomic file write for prototype; production migrate to PostgreSQL, transactional uniqueness and managed secrets.
- Acceptance/tests: Farmer/Driver register, duplicate normalized email rejected, admin/weak password rejected, password not stored as plaintext; app shows errors and success.

### Feature 4: Login, identity and logout
- Role/goal: registered Farmer/Driver (and later securely provisioned Admin) authenticates; role is always supplied by server.
- UI: email/password login; signed-in identity panel with name and role; logout. Loading, invalid credentials, offline/network, expired token, signed out.
- Actions: login, restore session on restart, logout; never authorize based on saved public role preference.
- Auth API: POST /api/auth/login {email,password} -> 200 {token,expiresAt,user}; GET /api/auth/me Bearer token -> {user}; POST /api/auth/logout Bearer token -> 204. Errors: 400,401,429,503.
- Entities: Session {tokenHash,userId,expiresAt,createdAt}, User. Token is cryptographically random, hashed at rest, stored in mobile platform secure store.
- Authorization: protected routes require valid unexpired session. Constant-time hash comparison and generic bad-credential response. Server-side throttling.
- Acceptance/tests: correct login, wrong password, session restoration, logout revocation, unauthorized access rejected, role cannot be escalated through client preference.
- Operational limitations: local HTTP is allowed ONLY for LAN development; production requires HTTPS and secure managed storage. No live hosted backend or email verification yet.

## 2026-11-07 implemented: Farmer role guard and overview

### Feature 5: Farmer RBAC vertical slice
- Role/goal: Authenticated Farmer accesses own dashboard API; Driver/Admin and anonymous clients cannot.
- Fields: Authorization Bearer token only. No userId or role from client input.
- API: GET /api/farmer/overview returns 200 {user:{id,name,email,role},summary:{totalRequests,pendingRequests,activeTrips}}; 401 missing/expired/invalid token; 403 valid non-Farmer token; 503 storage error.
- Server flow: validate session token digest, check expiry, load user, enforce farmer role, filter records by farmerId and tripAssignments to that user's requests.
- Data: Users, Sessions; optional persisted Requests, Trips, TripAssignments. No new database tables or synthetic records.
- Tests: anonymous, malformed token, driver denial, Farmer allowed, isolation between two farmers, revoked token denial.
- Scope: applies to this new protected endpoint. Full API authorization framework will expand when further endpoints are introduced.

### Feature 6: Farmer dashboard
- Role/goal: Farmer sees their own name and true request/trip counts after login; Driver/Admin retain authenticated account screen.
- UI fields: read-only name, total requests, pending requests, active trips; no data entry.
- Actions: automatic fetch, retry after network failure, logout. No dead request-creation button.
- Authorization: mobile uses server-authenticated user role to select dashboard, backend independently enforces role and ownership.
- States: loading spinner, zero-record explanation, populated counts, network/API error and retry, 401 session-expired returning to login.
- Acceptance: no fake metrics, only own records, valid role navigation, successful Android JS export and TS typecheck.
- Tests: backend integration of authorization and record counts; mobile build/typecheck CI. Physical device UI remains unverified.

## 2026-11-08 planned before implementation: Farmer create request and persistence

### Slice 7 — Farmer create transportation request API
- Role/goal: authenticated Farmer submits one agricultural pickup request for exactly one market.
- Fields: productName (2–80 chars), category enum vegetable/fruit/grain/other, handling enum standard/fragile/chilled, quantityKg (number >0 <= 50000), pickupAddress (5–200 chars), marketName (3–120 chars), pickupDate YYYY-MM-DD, pickupTime HH:mm in Nepal (+05:45), maxTransitHours integer 1–168. All required. No farmerId/status accepted from client.
- Actions: POST /api/farmer/requests with JSON. Server validates and derives owner from authenticated session. GET /api/farmer/requests returns only own persisted requests newest-first.
- Auth/flow: bearer session -> user -> Farmer role -> validate -> serialized JSON transaction -> response 201 {request}; GET -> 200 {requests}. Invalid fields 400 {error,fields}; missing/expired 401; non-Farmer 403; body >8KiB 413; storage failures 503.
- Data: Requests {id,farmerId,productName,category,handling,quantityKg,pickupAddress,marketName,pickupAt,maxTransitHours,status:'pending',createdAt}; no trip/vehicle allocation yet.
- States: empty list, loading, persisted list, invalid input, authorization denied, network/storage failure. Tests: invalid dates/weight, future window, extra injected owner/status ignored, cross-Farmer isolation, Driver denied, data survives new store instance.
- Acceptance: validated request persists, belongs to authenticated Farmer and appears in Farmer overview and GET list; invalid requests never persist.

### Slice 8 — Farmer mobile request form and dashboard integration
- Role/goal: signed-in Farmer creates and reviews their own requests.
- Fields: same API fields with explicit Nepal date/time format hints, accessible labels and field error messages; no GPS dependency.
- Actions: Dashboard Create transport request -> form -> submit -> success dashboard refresh, Cancel -> dashboard, Retry dashboard after offline error, Logout.
- API: POST /api/farmer/requests, GET /api/farmer/requests, existing GET /api/farmer/overview; bearer token from secure session.
- UI states: form idle, invalid, submitting, failed (retain inputs), success; dashboard loading/empty/list/error/retry, session expiry to login. Only Farmer sees create action; server checks independently.
- Acceptance/tests: UI integrates API and real counts; successful submission visible without restart; no fake matches or dead buttons. Backend integration and Android bundle/typecheck in CI; physical device remains unverified.

## 2026-11-09 implementation specification: Farmer request details/edit and cancellation
**Role/goal:** authenticated Farmer inspects, corrects or cancels only their own transport request before assignment. Driver/Admin cannot use these endpoints.
**Data:** TransportRequest id, farmerId, productName, category, handling, quantityKg, pickupAddress, marketName, pickupAt, maxTransitHours, status, createdAt, revision (default 1 for legacy requests), updatedAt; no deletion on cancellation.
**Detail UI:** read-only labeled values and status; loading, not found/forbidden, offline/retry; edit and cancel actions only when pending, back to dashboard. GET /api/farmer/requests/:id returns {request}.
**Edit UI:** same fields/choices as creation prefilled from saved record; submit or discard; form and field errors, saving state, stale conflict warning. PATCH /api/farmer/requests/:id accepts complete validated RequestInput plus revision, checks owner and pending state inside serialized transaction, validates Nepal pickup time and positive weight, increments revision. Returns {request}. 400 fields invalid, 401 unauthenticated, 403 wrong role, 404 not owned, 409 stale revision or no longer pending.
**Cancel UI:** explicit confirmation screen/action, busy/error and success state. POST /api/farmer/requests/:id/cancel accepts {revision}; transaction checks pending status and revision, sets cancelled and increments revision; does not remove historical data. 409 already cancelled, assigned or stale.
**Tests:** two Farmers + Driver + missing/revoked token, foreign ID 404, invalid edits, stale revision, valid edit persisted, cancel persisted, cancelled request cannot be edited/cancelled again, dashboard counts update. CI must pass Node API/mobile tests, TypeScript and Expo Android bundle.

## 2026-11-10 pre-implementation plan: Driver overview and vehicle registration
Repository inspection: main reported a7150a62bec2f0ce7b42eda799bb1c04d57ae9de; latest three CI runs green; no open issues. IMPORTANT: contents/tree API currently returns older application files that omit the request edit/detail code listed in the November 9 commit diff. Do not assume the prior edit/cancel feature is accessible in the current branch until reconciled. Today's additions must not overwrite Farmer code or pretend to fix that discrepancy.

### Slice A: Driver dashboard (authenticated)
Role: Driver. Goal: see own real vehicle count and registered vehicle summaries, without fabricated trips. UI fields: authenticated name, vehicle count, registered vehicle list; no editable fields. Actions: refresh, open registration form, logout. States: loading, zero vehicles, populated, network error/retry, expired session. API: GET /api/driver/overview -> 200 {user,summary:{totalVehicles},vehicles:[...]}; missing/expired token 401, non-Driver 403. Data: users, sessions, vehicles. Authorization: server derives driverId from bearer session; no client owner IDs. Acceptance: two Drivers cannot see each other's vehicles; zero count from actual storage. Tests: auth, role denial, isolation, empty/populated counts, persistence.

### Slice B: Driver vehicle registration
Role: Driver. Goal: record a usable vehicle for future matching. UI fields: registration plate, vehicle type (bike/mini_truck/truck), body (open/covered/refrigerated), maximumWeightKg, optional maximumVolumeM3. Actions: enter, select, submit, cancel, return to dashboard. States: initial, invalid fields, submitting, duplicate plate, success, offline/retry. API: POST /api/driver/vehicles -> 201 {vehicle}; GET /api/driver/vehicles -> 200 {vehicles}; invalid 400 {fields}, duplicate 409, auth 401, role 403, storage 503. Data: vehicles[] with server-generated id, driverId, status 'registered', timestamp; never auto-approved for matching. Validation: plate normalized uppercase (3-20 safe characters), positive finite kg <= 50000, optional finite m³ >0 <= 200, strict vehicle/body enums; reject invalid combinations (refrigerated bike). Authorization: driverId from authenticated session only. Acceptance: persistence, duplicates blocked across Drivers, injection of owner/approval ignored. Tests: invalid payloads, duplicate plate, persistence, role isolation, no self-approved vehicles.

Before implementation: preserve three roles, single-market routing requirements, and existing Farmer flow; no matching/booking claims. Implement only these two connected slices and require API tests, mobile tests, TS and Android Expo bundle CI.

## 2026-11-11 pre-code contract: restore Farmer request lifecycle (two slices)

Audit: current main tree contains Farmer request create/list but NO GET/PATCH/cancel request-detail API and NO RequestDetailScreen despite older documentation claiming implementation. This is a regression, not a completed feature. Restore exactly two connected slices without rebuilding existing create/list or Driver vehicle features.

### Slice A: Farmer request details and editing
- Role/goal: authenticated Farmer views own saved request and edits only pending request.
- UI: request detail screen shows product, category, handling, kg, pickup, market, Nepal pickup time, maximum transit, status and revision; Edit opens existing request form prefilled. States: loading, missing/forbidden, network error with retry, pending editable, cancelled read-only, editing/submitting, validation errors, revision conflict.
- Actions: open request, edit, save, back, retry. Required input same as existing create form, with revision integer >=1 on PATCH; server validates product/category/handling/quantity/address/market/Nepal date/time/maxTransitHours.
- Authorization/data: bearer session, Farmer role, farmerId from server session, owner-scoped Request; never trust supplied farmerId/status. No edit after assignment/status transition.
- APIs: GET /api/farmer/requests/:id -> 200 {request}, 401/403/404; PATCH /api/farmer/requests/:id {revision,productName,category,handling,quantityKg,pickupAddress,marketName,pickupDate,pickupTime,maxTransitHours} -> 200 {request}; 400 field validation, 409 stale/non-pending, 404 non-owner, 503 storage failure. JSON transaction checks revision/status atomically; updatedAt/revision increment.
- Acceptance/tests: own GET and PATCH persist across restart; another Farmer 404, Driver 403, missing token 401, invalid fields 400, stale revision 409, cancelled 409. Mobile TS/Expo bundle and navigation check in CI; physical phone unverified.

### Slice B: Pending request cancellation
- Role/goal: Farmer cancels an unassigned pending request without deleting history.
- UI: same detail screen has Cancel request action, explicit confirmation alert, busy/error states; cancelled request shows status and disables edit/cancel. User can return to refreshed dashboard.
- Actions: confirm or dismiss, cancel with expected revision. API POST /api/farmer/requests/:id/cancel {revision} -> 200 {request} (status cancelled, revision increment, updatedAt), 400 missing revision, 401/403/404, 409 stale/non-pending. Serialized transaction ensures atomic status/revision check; no driver booking exists yet.
- Acceptance/tests: confirmation required in UI; cancel persists and overview pending count falls; repeat cancel/edit rejected, other owner inaccessible, no deletion, server-generated status only.

### 2026-11-11 implementation note
The lifecycle pair specified above is restored in source: apps/mobile/src/screens/RequestDetailScreen.tsx, existing CreateRequestScreen with optional prefilled edit mode, dashboard detail navigation, and server GET/PATCH/cancel routes. Request revisions begin at 1; legacy records without revision read as 1. New integration tests live in apps/api/tests/request-lifecycle.test.js. CI status is tracked in PROGRESS.md. The request is not a booking, and cancellation does not release any assigned capacity because trip allocation has not been built.


## 2026-11-12 — Driver availability and preliminary eligibility (implemented)

### Driver availability management screen
- Role/goal: authenticated Driver declares a future available window for an owned registered vehicle and its starting address; not live location.
- Fields: vehicle selector (owned vehicle ID), date YYYY-MM-DD, Nepal-local startTime/endTime HH:mm, startAddress (5–200 characters).
- Actions: open from Driver dashboard, select vehicle, save or replace a same-date declaration, see saved declarations, retry, return.
- Validation: real calendar date, same-day start strictly before end, end in future within 365 days, nonempty address, server-derived driver ID; reject forged vehicle IDs.
- Authorization/entities: Bearer session, Driver role, owned Vehicle, Availability record keyed by vehicleId/date. Other drivers receive 404; Farmer 403; anonymous 401.
- API/backend: GET /api/driver/availability returns owner-scoped declarations; POST /api/driver/vehicles/:id/availability validates and transactionally replaces same vehicle/date record in JsonStore. Returns 200 {availability}.
- UI states: initial loading, no registered vehicles, populated declarations, field errors, network failure/retry, saving, success, expired session.
- Acceptance/tests: future same-day declaration saved, reload persists, same-date save replaces not duplicates, other Driver cannot access, invalid window rejected; mobile TypeScript and Android JS bundle.

### Preliminary eligibility preview on Driver availability screen
- Role/goal: authenticated Driver checks whether an owned vehicle has enough declared payload and a window covering a proposed pickup time; NOT a booking or farmer offer.
- Fields: selected owned vehicle, pickup date YYYY-MM-DD, time HH:mm Nepal local, positive weightKg (at most 50,000).
- Actions: Check eligibility, read pass/fail and precise reasons, change inputs, retry.
- Validation: real date, time, positive finite weight; request time must be future. Window includes start and excludes end.
- Authorization/entities: same Driver guard; reads owned Vehicle and matching Availability record; no mutation.
- API/backend: GET /api/driver/vehicles/:id/eligibility?date=...&time=...&weightKg=... -> 200 {vehicleId,eligible,reasons,checks,note}. 400 invalid query, 401/403/404 auth/ownership.
- UI states: loading while request, error, no vehicle, result with reasons, no declaration. No fake available offers.
- Acceptance/tests: 500 kg vehicle accepts exactly 500 kg, rejects 501; 09:00 inclusive, 17:00 exclusive; missing declaration rejects; role/ownership enforced.
- Deliberate limitation: no product compatibility, vehicle approval, volume, perishability, route feasibility, market/date grouping, or driver acceptance in this preliminary check. Do not treat eligible=true as dispatch authorization.

## 2026-11-13: Farmer request matching preview (planned before code)

Role/goal: authenticated Farmer inspects feasibility for an existing pending transport request. Read-only view embedded in request detail, no form fields or ability to book. Action: refresh preview. Inputs from server: saved request ID, product category, handling, kg, pickup instant, market; registered vehicles and Driver declarations. Authorization: valid session + Farmer role + request owner. API: GET /api/farmer/requests/:id/matches. Response: { requestId, group: { marketName, pickupDate, pendingRequestCount, totalWeightKg }, candidates: [{vehicleId, vehicleType, bodyType, maximumWeightKg, eligible, reasons}], note }. Do not expose other Farmer names, locations, request IDs, or Driver private details. Matching checks: product handling, vehicle type/body, weight and date/time availability; no approval, routing, volume, perishability or driver acceptance. Group by trimmed case-folded market name and Nepal date of pickup; cancelled requests excluded. States: loading, retryable network/server error, no candidate vehicles, candidates with reasons, group count 1. Acceptance/tests: 401/403/404, cross-farmer privacy, chilled/fragile/open/covered/refrigerated, weight, availability, same-market/day, different-market/day, cancelled exclusion; mobile TypeScript and Android JS bundle. JSON DB unchanged (derived read-only).

## 2026-11-14 — Capacity allocation plan and implementation

### Slice A: read-only same-market/day capacity allocation
- Role and goal: authenticated Farmer previews whether a group of compatible pending requests might fit available vehicle payload.
- Fields: no new inputs; reads existing request's market, Nepal-local date, pickup time, category, handling and quantityKg, plus registered vehicles and declared availability.
- Actions: GET /api/farmer/requests/:id/matches; does not create a trip or reserve capacity.
- Auth/data: existing bearer Farmer session and ownership guard; JsonStore requests/vehicles/availability read only. Nonowner 404, Driver 403, missing/expired session 401, nonpending 409.
- Output: allocation {assignedRequestCount,unassignedRequestCount,assignedWeightKg,unassignedWeightKg,vehicles:[{vehicleId,allocatedRequestCount,allocatedWeightKg,remainingWeightKg}],note}. No Farmer identity, pickup address, other request IDs, or Driver contact.
- Rules: one normalized market and date, pending only, indivisible loads, deterministic descending weight and stable IDs, integer gram arithmetic, capacity, handling/body type and each request's pickup-time availability. No multi-trip capacity reservation.
- States: zero vehicles, no feasible assignments, partial, complete provisional fit; backend error and retry through existing detail screen.
- Acceptance: 500 kg vehicle fits 300+200 and leaves 100 unassigned; incompatible products/time windows excluded; stable order, no mutation, privacy; API tests and Android bundle.

### Slice B: Farmer allocation results UI
- Role and goal: Farmer views truthful group-level provisional kg allocation, unassigned load and per-vehicle remaining kg.
- Page: existing RequestDetailScreen; Preview compatible vehicles and market group button; no new input fields.
- Actions: load and retry existing GET, return to dashboard. No booking/acceptance button.
- States: loading, API error/retry, empty eligible vehicles, assigned/unassigned results, expired session.
- Authorization: all computations and ownership enforcement on server; client renders aggregates only.
- Acceptance: TypeScript and Expo Android export pass; clearly labels preview nonbinding; physical phone testing not claimed.


## 2026-11-15 built backend slices: geographic validation and road matrix

### Explicit coordinate validation (backend only)
- User/goal: future Farmer pickup/market and Driver starting-location forms need exact coordinates, never inferred from address strings.
- Inputs: `latitude` and `longitude` as finite numeric decimal degrees; ranges [-90,90] and [-180,180].
- UI states/actions: no new mobile form in this slice; future UI will need empty, invalid, save/loading and ownership-protected edit states. No dead button introduced.
- Authorization/storage: pure helper `validateCoordinates` and `osrmCoordinate`; no endpoint or persistence. Existing request/availability ownership rules unchanged.
- Contract: returns `{valid,fields,point}`, or throws when attempting OSRM formatting of invalid data. Coordinates remain private until a dedicated authorized API is designed.
- Acceptance/tests: boundary, missing, nonnumeric, nonfinite, invalid range, OSRM lon/lat order.

### OSRM distance/time matrix adapter (backend only)
- User/goal: future authorized route calculation, not yet an exposed Farmer or Driver page.
- Inputs: ordered 2–25 validated points; configured trusted public HTTPS origin, injectable fetch and bounded timeout.
- Actions: call OSRM table API with `annotations=distance,duration`, preserve directed/asymmetric matrices, fail closed on unreachable pairs.
- API/data: internal `roadMatrix(points,options)` returns `distancesMeters`, `durationsSeconds`, `pointCount`; no public API, database writes or external coordinates sent by the app yet.
- UI states: no new mobile UI; future route screen must show loading, no route, retry, error and estimates, never fake distances.
- Acceptance/tests: reject bad point count/URL/timeout, non-OK responses, nulls, malformed dimensions; validate coordinate order and meters/seconds.
- Limits: no live routing integration, route ordering, Clarke-Wright, 2-opt, booking or physical Android preview yet.

## 2026-11-16 — coordinate fields on existing native forms (planned before code)
**Farmer / CreateRequestScreen and edit mode:** Goal: explicitly locate pickup and one destination market. Fields: existing request inputs plus optional pickup latitude/longitude and market latitude/longitude as paired decimal degrees. Actions: enter/edit/clear both fields per point, submit, cancel. UI states: blank pair (address-only, no routing), filled valid pair, partial/invalid pair with inline error, saving, API/network failure, saved. Validation: numeric finite latitude [-90,90], longitude [-180,180], both required if either entered; server repeats checks. Authorization: Farmer session, owner on PATCH, pending-only and revision conflict. Entities: requests.pickupCoordinates and requests.marketCoordinates, null when omitted. API: existing POST/PATCH/GET Farmer request routes. Acceptance: valid coordinates persist and round-trip; invalid/partial rejected; legacy address-only requests work; no other Farmer's details exposed. Tests: unit validation, create/edit persistence, role and owner guards.
**Driver / DriverAvailabilityScreen:** Goal: declare where vehicle begins, not live GPS. Fields: existing date/time/start address plus optional start latitude/longitude pair. Actions: save/replace own declaration, review stored location, check existing eligibility. UI states: blank, partial/invalid with field errors, loading, saving, success, network error/retry. Validation: same coordinate ranges and paired rule. Authorization: Driver session and owned vehicle only. Entity: availability.startCoordinates null or valid point. API: existing POST /api/driver/vehicles/:id/availability and GET /api/driver/availability. Acceptance: valid point persisted on date replacement, owner-only visibility, malformed/partial denied; text-only records still work. Tests: unit validation, API role/owner/persistence/replacement. No routes or map display yet.

### 2026-11-16 implementation verification scope
Existing native Farmer create/edit request form now accepts optional pickup/market latitude+longitude pairs and sends them to existing POST/PATCH endpoints. Existing native Driver availability form accepts optional start latitude+longitude pair and saves via existing POST availability endpoint. Paired-field validation runs locally and on server; blank pair becomes null. Existing loading/saving/error/retry and role/ownership checks remain. API tests in apps/api/tests/coordinates.test.js exercise validation, persisted round-trip, Farmer cross-owner 404, Driver/Farmer 403 and stale revision 409. No OSRM preview yet; Expo Android physical-device check still needed.


## Built 2026-11-17: Farmer route readiness and OSRM road preview (API-only slices)
- User/goal: authenticated Farmer assesses road-preview readiness for their own pending transport request, then obtains a fixed Driver-start → own pickup → one destination-market road estimate.
- UI: no new mobile screen in these two backend slices; the existing Farmer request detail and coordinate form remain unchanged. API response states ready=false with reasons, ready=true with two directed legs, 400 query validation, 401 unauthenticated, 403 wrong role, 404 not owned, 409 nonpending, 429 preview rate limit, 503 routing unavailable.
- Input: existing saved pickupCoordinates, marketCoordinates, Driver availability startCoordinates, vehicle compatibility and availability; optional vehicleId UUID query. No arbitrary URL, address geocoding, or client-supplied location.
- Authorization: session-backed Farmer role, owner-scoped request; no other Farmer addresses, coordinates or request IDs returned. Vehicle candidate must pass existing compatibility and availability checks.
- API: GET /api/farmer/requests/:id/route-preview; if ready=false, returns reason codes; if ready=true, invokes trusted backend OSRM matrix with three points and returns selected vehicle ID/type, directed leg distances/durations and totals. No database mutation.
- Data: requests, vehicles, availability and sessions in local JSON store; no new persistent fields.
- Validation: valid stored coordinates; selected vehicle eligible; no fabricated fallback for missing/unreachable roads; 12 road previews/minute per authenticated Farmer (in-process).
- Acceptance: only own pending requests, exactly one destination market, Driver start fixed first and market fixed last, no booking or multi-pickup claims, failure sanitized.
- Tests: route-preview.test.js exercises missing/invalid coordinates, role/owner/status, query rejection, deterministic eligibility, directed asymmetric matrix, privacy, no mutation and upstream 503. Physical-device UI is not verified.


## Built 2026-11-18: Farmer single-request road preview
- Role/goal: authenticated Farmer previews road readiness and estimated driving time for their own pending request.
- Page: RequestDetailScreen; no new editable fields; button 'Preview road route' calls the typed client.
- Inputs: existing request ID, persisted own pickup and market coordinates, selected eligible Driver vehicle's declared starting coordinates; no arbitrary client-supplied coordinates.
- UI states: idle; loading with disabled duplicate action; ready=false with human-readable missing pickup/market/Driver start or eligibility reasons; ready=true with two directed legs and total km/min; 401 session expiry; 429/503/network error with retry. Existing edit/cancel and matching preview remain functional.
- Authorization: existing GET /api/farmer/requests/:id/route-preview validates session, Farmer role, ownership, pending state. API returns no other Farmer coordinates or full matrix.
- Data/API: existing requests, vehicles and availability; GET endpoint unchanged. No writes or schema changes.
- Acceptance: never show fabricated distance, clearly label single-pickup estimate as provisional, fixed Driver start → own pickup → one market, no Driver acceptance or booking. Verification gate: mobile tests, TypeScript and Expo Android JavaScript bundle.


## Built backend domain slices (2026-11-19): fixed-endpoint Clarke-Wright and 2-opt
- Roles and goal: future authenticated Farmer preview / Driver proposal; currently pure backend planning functions, **not** a public screen or endpoint.
- Fields: ordered pickup IDs, positive weight kg, optional maximum transit seconds, pickup arrival window, vehicle maximum kg, directed OSRM distance and duration matrices, optional maximum route duration, trusted compatibility predicate.
- UI states: no UI action added. Future integration must display loading, missing coordinates, infeasible/unassigned, network failure and retry; do not show private Farmer coordinates to other Farmers.
- Actions: `clarkeWrightOpenRoutes` merges positive-saving routes with fixed Driver start and market end; `improveFixedEndpointTwoOpt` reverses pickup segments when strictly shorter and feasible.
- Validation: 1–23 unique pickups, finite nonnegative square matrices, positive finite capacity/weights, optional perishability/window constraints, integer indices. Invalid contracts throw TypeError; infeasible candidates return reason.
- Authorization: caller must enforce authenticated role, request/vehicle ownership and group market/date restrictions before calling. No direct public API, no writes, no booking.
- Entities/flow: existing requests, vehicles, availability and OSRM matrix; no schema changes.
- Acceptance/tests: endpoints never move, directed asymmetric arcs fully recomputed, no capacity overrun, no invalid perishability/window or incompatible merge, deterministic results and unchanged inputs. `apps/api/tests/optimization.test.js`.
- Limitations: no same-market grouping orchestration, actual pickup schedule mapping, route persistence, driver acceptance, cost sharing or Expo mobile UI. No claim of end-to-end route optimization.

## Built 2026-11-20: Farmer shared optimized route preview
- Role/goal: authenticated Farmer views a provisional multi-Farmer route for their own pending request without seeing another Farmer's private data.
- UI: existing RequestDetailScreen; action "Preview shared optimized route", loading spinner, retryable API failure, not-ready reason codes, summary (vehicle type, own pickup position, number of pickups, total kg, km, duration, 2-opt improvement, excluded count), and explicit nonbinding warning. No editable fields.
- Backend: GET /api/farmer/requests/:id/optimized-preview?vehicleId=UUID (optional). Farmer token and request ownership required; request pending. 401 unauthenticated, 403 wrong role, 404 foreign/unknown, 409 nonpending, 400 invalid query, 429 throttle, 503 routing failure.
- Data: saved requests, vehicles, availability, coordinates; no writes. Same normalized market/Nepal date and market coordinates, compatible body/handling and vehicle availability, capacity, pickup time, perishability and route duration. Directed OSRM table, adapted Clarke-Wright, then fixed-endpoint 2-opt. Bound at 23 pickups and ensure caller included.
- Privacy: response deliberately excludes other Farmer IDs, coordinates, names, addresses, and full pickup sequence. Only own pickup ordinal and aggregates.
- Acceptance/tests: authenticated owner can preview; other roles/owners cannot; missing coordinates and infeasible route show reasons; no fabricated road distances; deterministic algorithm fixtures and nonmutation; API tests, mobile tests, TypeScript and Expo Android JS export. Physical Android and live OSRM are not verified.
- Limitations: read-only heuristic, no actual booking or driver acceptance; volume, service times, traffic, vehicle approvals and cross-category product compatibility remain unverified. For now only matching handling classes share a route.


## Built 2026-11-21: Safe co-loading preview (existing Farmer RequestDetailScreen)
- Role/goal: Farmer inspects a provisional same-market/date allocation; no new screen or button.
- Inputs: existing category, handling class, quantity kg, vehicle body/capacity and availability. No new form fields.
- Actions/UI: existing preview, refresh, loading, error and empty states. Same authenticated GET /api/farmer/requests/:id/matches; no API shape change.
- Authorization: Farmer session and request ownership enforced by existing endpoint; response returns aggregate vehicle allocation, never other Farmers' identities.
- Validation: pairwise symmetric same-handling-class policy, with unknown classes rejected; vehicle body, weight, date/time eligibility still apply.
- Entities: requests, vehicles, availability (read only). No persisted assignments or bookings.
- Acceptance/tests: different handling classes cannot share a vehicle; separate vehicles may carry them; deterministic, capacity safe, immutable, no private details.
- Limitation: same-class policy is conservative, not crop-level odor or fragility modeling; no route feasibility or driver acceptance.


## 2026-11-22 — Backend-only Driver offer lifecycle
**Slice 35, Farmer proposal:** Authenticated Farmer goal is to request a single-pickup route offer for an owned pending request. No mobile form is added yet; POST /api/farmer/requests/:id/offers takes only a valid vehicleId UUID. Backend reads persisted Farmer request, vehicle and Driver availability, checks coordinates, registered status, payload, handling class, time window, then uses directed OSRM matrix and evaluatePickupRoute to enforce arrival, duration and perishability. Stores a 30-minute proposed offer containing request revision, owner IDs, one market/date, weight and route estimates. Duplicate live proposals return 409. 400 malformed body, 401 session, 403 wrong role, 404 nonowner, 409 ineligible/conflict, 429 throttling, 503 OSRM failure. API response returns only the own offer summary. Empty/no vehicle, missing coordinate, OSRM unavailable and expired offer are explicit errors. Tests: proposal persistence, route feasibility, role, owner, duplicate, invalid payload, and no mutation on failure. **No mobile button exists yet.**
**Slice 36, Driver decision:** Authenticated Driver goal is to inspect own offers via GET /api/driver/offers and POST /api/driver/offers/:id/accept or /decline. No new native page this run. Empty list is `{offers:[]}`; resolved offers remain visible with status. No client fields are trusted on decision. Transaction checks offer owner, proposed state, expiry, current pending request/revision, vehicle registration, weight/handling, availability and competing accepted trip/date; acceptance writes a trip, assignment, request assigned state and offer accepted state in one serialized JSON transaction. Decline writes only declined offer state. Errors: 401 session, 403 wrong role, 404 other Driver, 409 stale/replayed/expired/conflict, 503 storage failure. Tests cover cross-driver, stale revision, conflict, replay, expiry, decline and durable JSON records. This is a **single-request trip**, not a multi-Farmer booking, and mobile UI is still outstanding.


## Built 2026-11-23: Farmer single-request offer creation UI
- Role/goal: authenticated Farmer proposes one pending owned request to one eligible vehicle; never an automatic booking.
- Fields: eligible vehicle selection from GET /api/farmer/requests/:id/matches; proposal confirmation; status and expiry display.
- Actions: load eligible vehicles, select one, confirm POST /api/farmer/requests/:id/offers {vehicleId}, retry errors.
- Validation: client requires pending request and selected eligible vehicle; server validates ownership, coordinates, weight, handling, Driver availability, OSRM route, duplicate offers and request revision.
- Entities: requests, vehicles, availability, offers. No schema change.
- States: initial, matching loading/error/empty, selected, confirmation, submission busy, success with expiry, 401 session expiry, 409 conflict and 503 routing failure.
- Acceptance: no proposal without confirmation; only server response shows success; Driver must explicitly accept. Backend offers tests, TypeScript and Expo Android bundle.

## Built 2026-11-23: Driver offers and decision screen
- Role/goal: authenticated Driver views own proposals and accepts or declines a single-request trip.
- Fields: market, pickup date, kg, distance, duration, status, expiry; no other Farmers' identities/coordinates.
- Actions: dashboard navigation, GET /api/driver/offers, refresh, confirm POST /api/driver/offers/:id/accept or /decline, return.
- Validation/authorization: server enforces Driver role, offer ownership, expiry, request revision, vehicle capacity/availability and booking conflicts transactionally in the development JSON store.
- Entities: offers, trips, tripAssignments, requests; no schema change.
- States: loading, empty, populated, expired, accepted/declined, confirmation, busy, error/retry, session expiry and 409 refresh.
- Acceptance: no decisions on resolved/expired offers; confirmation required; server success is authoritative; physical Android UI not yet verified.
