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
