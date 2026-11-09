# ATPRO Architecture and Technical Feasibility

## Modules and data flow

Mobile app (Expo React Native; public screens BUILT)
  → future authenticated Node.js JSON APIs
  → future PostgreSQL transactions + audit log
  → vehicle matching/booking service
  → OSRM routing using OpenStreetMap road data
  → Clarke-Wright initial pickup order
  → constrained 2-opt improvement
  → trip proposal, explicit driver acceptance and delivery confirmation.

Only the first mobile public screens and preference store are in the current repository. No server, PostgreSQL connection or routing implementation is claimed.

## Core future database entities

- Users: id, role (Farmer/Driver/Admin), verified identifier, name, hashed password, status.
- Vehicles: driver owner, registration plate, type, body/cooling capability, maximum kg and volume, status.
- Products: category, handling requirements, perishable maximum transit constraints, compatibility flags.
- TransportRequests: farmer, product, kg, volume, origin, market, pickup/delivery time windows, state, version.
- Trips: assigned driver and vehicle, market, start location, proposed/accepted route, cost and delivery state.
- TripAssignments: trip, request, allocated quantity, pickup sequence, pickup/delivery confirmations.
- Supporting Markets, Availability, Sessions, AuditEvents, and reservation/version records.

## System invariants

1. Exactly three authenticated roles. Cooperative operators may assist farmers as a workflow, not as another privileged role.
2. A trip has exactly one destination market for the initial project version.
3. Drivers may start far from pickups, including another city. Final route objective includes real driver-to-first-farmer travel.
4. Transport requests are compatible by product type, fragility, odor, refrigeration/cover and handling.
5. Vehicle payload allocations cannot exceed available weight or volume; concurrent bookings must use database transactions.
6. Driver time window, requested market delivery time and perishability are hard constraints.
7. Driver acceptance cannot be simulated or silently assumed.
8. Pickup and delivery state transitions are explicit, authorized and audited.

## Algorithms

Priority and product classification → group same market/date → compatible vehicle eligibility → capacity allocation heuristic → road distance/time matrix → initial pickup order → hard-constraint filtering → 2-opt → driver acceptance → tracking and cost sharing.

Classic Clarke-Wright savings uses S(i,j) = d(M,i) + d(M,j) - d(i,j), for a single-depot cycle at M. ATPRO uses an open D-to-M route, so the classical savings rule needs a documented adaptation or a route insertion approach that evaluates the driver start D and end M. Never apply a depot-cycle result blindly as optimal for a different start/end.

For a fixed-endpoint route D → A → B → C → M, 2-opt selects pairs of non-adjacent edges, reverses the intermediate pickup subsequence, and accepts a strictly shorter route only if capacity, time and perishability still satisfy all constraints. D and M remain in place.

Road distance is not straight-line distance. OSRM and OSM are open source but public demos and map tiles are usage-limited. Cache matrices and handle service failure; production-scale hosting is not guaranteed free.

## Security design

Client role preference stored in AsyncStorage is public browsing state only, NOT a session or authorization. Future server validates sessions, role permissions, resource ownership, vehicle eligibility, quantity, and status transitions for every API request. Password hashing uses a reputable salt-and-work-factor scheme (Argon2id or scrypt); store mobile credentials only in platform-protected secure storage, never in the public preference key. Audit booking, approval and delivery mutations.

## Feasibility

- Technical: React Native + Expo enables Android client prototyping on an ordinary laptop with Expo Go. Backend Node.js, PostgreSQL and routing algorithms can be developed with free/open-source software.
- Financial: Development tools cost no software license fee; always-on server, hosting, bulk SMS/OTP, OSM tile usage and traffic may incur future expenses.
- Operational: Support mobile users, optional cooperative assistance for farmers unfamiliar with apps, and manual declared locations to avoid requiring live GPS. Network failures must be visible.
- Testing: create algorithm fixtures with multiple drivers, farmers, compatible/incompatible products, 500kg allocation with remaining 100kg and time-sensitive tomatoes. Compare baseline vs optimized distance and reject infeasible routes.
- Scope: single market per route, fixed-endpoint pickup sequence, no paid services for local proof of concept. Multiple destination markets and live GPS can remain future scope.

## 2026-11-06 authentication implementation plan

Add apps/api as a Node.js 22 built-in HTTP API with no paid services or framework dependency. Endpoints POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout. Store users and SHA-256 token digests in a private JSON file for single-process local development. Use scrypt password hashing with random salts, fixed-work-factor comparisons, cryptographically random bearer tokens, generic login errors, request-size limits and basic IP rate limiting. Serialize writes and atomically replace storage file; avoid concurrent-process deployment. Use secure-store for device tokens and EXPO_PUBLIC_API_URL for backend location. Never trust local role preference as an authenticated role. Production requires PostgreSQL, HTTPS, rate limiting across instances, email verification and admin provisioning.

## 2026-11-07 RBAC and Farmer overview implementation

A new protected GET /api/farmer/overview endpoint validates an 8-hour server-issued bearer session and checks the stored user's role before reading any farmer data. It returns 401 for missing/invalid/expired sessions and 403 for a valid non-Farmer. Counts derive from persisted request records filtered by farmerId, and active trips derive from assignments to those requests; absent collections are empty. This is an early vertical slice, not a complete generic authorization framework. The React Native FarmerDashboardScreen uses the token from Expo SecureStore, loads the API on entry, shows loading/error/retry/empty/populated states, and routes expired sessions to login. Driver and Admin still see AccountScreen. Request creation and persistence are NOT implemented.

## 2026-11-08 request submission design (planned before implementation)
New Farmer requests are written into db.requests using JsonStore.transaction, keyed by authenticated farmerId, with immutable pending status and server-generated IDs/timestamps. Pickup date/time is interpreted as Asia/Kathmandu local civil time (+05:45) and stored as UTC ISO pickupAt. Each request has exactly one marketName; product category, handling and maxTransitHours are stored for later compatibility and perishability checks, not yet evaluated by a routing engine. GET /api/farmer/requests scopes by owner. The dashboard continues to use persisted request counts; mobile request form posts to API and reloads counts and list. JSON file persistence is not production multi-process safe and does not provide DB transactions across services. PostgreSQL migration remains necessary.

## 2026-11-08 implemented request API + mobile flow
POST /api/farmer/requests and GET /api/farmer/requests require server-authenticated Farmer identity, use session digest and expiry checks, and derive farmerId from stored user. Request validation is isolated in apps/api/src/requests.js. Date/time input uses Nepal UTC+05:45 to avoid server timezone dependence. Request IDs/status/createdAt are server-issued, and a JsonStore serialized transaction atomically appends the pending record. GET filters requests by farmerId; Farmer overview reads the same persisted collection. Mobile CreateRequestScreen submits the request with secure bearer session and returns to FarmerDashboardScreen, which reloads real overview and saved request records. No matching, booking, vehicle allocation or route optimization has been implemented. A submitted pending request is NOT a confirmed transport booking.

## 2026-11-09 request lifecycle extension
Request records now carry a revision counter (legacy records read as revision 1), updatedAt on edits/cancellation, and statuses pending/cancelled. Mutations run inside the JSON store's serialized transaction and require authenticated Farmer ownership, pending status and matching revision. A cancellation is a retained status transition, not a delete. These constraints must later extend to vehicle matching/assignment so assigned requests cannot be modified by racing operations. JSON persistence remains single-process development-only; PostgreSQL migration and transactional locking are required before multi-instance production.
