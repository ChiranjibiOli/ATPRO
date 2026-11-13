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
