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
