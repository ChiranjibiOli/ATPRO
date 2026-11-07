# ATPRO Development Log

## 2026-11-05 — First committed Android-first mobile foundation

Initial repo inspection: main contained README.md only, commit 6eb871ddd58b584ab1c93077c6179f58af410f2c; no app code and no open issues.

Features implemented:
1. Mobile landing screen explaining workflow with functional navigation to roles.
2. Role selection with three roles, responsibility details, AsyncStorage preference save/restore/clear, invalid-value rejection and visible storage failure state.

Other changes: Expo SDK 58 and React Native TypeScript scaffold, reusable design colors/buttons, domain/storage contract separation, GitHub Actions checks, detailed page specs, architecture/feasibility and code flow manual.

Testing performed locally before GitHub push:
- Nine Node 22 domain/preference tests: PASS (9/9).
- TypeScript TS/TSX syntax transpilation over seven source files: no syntax diagnostics.
- Full npm install and native/Android preview: NOT VERIFIED because npm registry DNS was unavailable in this execution environment.
- GitHub Actions created for CI; assess its actual run result separately.

Implementation intentionally excludes actual registration/login, real transport booking, optimization, GPS, backend, PostgreSQL and Android APK. Prior web prototype archives were not merged without reviewing their development-only security and database assumptions.

Next two features: API-backed Farmer/Driver registration and authenticated login with server-controlled roles; never public Admin self-registration.

CI verification update: GitHub Actions workflow 42046622050 for commit 8e80873b247ae6686e36d28392009686affec713 completed successfully on 2026-11-05. Checks: nine domain/storage tests passed, npm dependencies installed, TypeScript validation passed, Expo Android JavaScript export succeeded. This validates a bundle, NOT an APK installation or physical-device user interaction. Public hosted preview remains unavailable; use Expo Go locally.

## 2026-11-06 — Authentication implementation

Feature 3: Farmer/Driver registration screen and POST /api/auth/register with strict roles, validation, duplicate detection, scrypt hashing and atomic local JSON storage.
Feature 4: Login screen, authenticated account, secure token restoration and logout. POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout. Token digests stored server-side, expiry 8 hours. Browser role preference is not authorization.
API storage apps/api/data/auth.json is gitignored; PostgreSQL, email verification and HTTPS hosting remain future work.
GitHub CI: API tests, mobile tests, npm install, TypeScript and Expo Android export required. Results verified separately. No Android physical device or public preview verified.
Next: RBAC and Farmer dashboard, with genuine API records and empty/error states.

CI verification: GitHub Actions run 42232482149 for commit 74d2bc30ca7b5191ee2ffdf632bfbb9965d7ff5a completed successfully: API integration tests, 9 mobile domain tests, dependency installation, TypeScript and Expo Android JavaScript export all passed. Follow-up commit dbb750917bc8f5a32d205085d9cb1de741933fc0 fixes Windows filesystem path resolution and requires a new CI pass. No APK or physical phone UI verification.

## 2026-11-07 — Farmer RBAC + dashboard

Repo audit: main head fe8b19e2fb5c052f492a1fd81e26b59c038db133 before this run; latest CI passed; no open issues. Skipped already-built landing, role preference, registration and login.
- Feature 5: server-enforced Farmer authorization on GET /api/farmer/overview, 401/403 and ownership-scoped counts.
- Feature 6: mobile FarmerDashboardScreen with server-provided name, actual request/trip counts, loading/error/retry/empty and logout.
- Added integration tests for two Farmers, Driver denial, missing/revoked tokens and owner-scoped records. No request creation UI, PostgreSQL, APK or hosted backend.
- CI outcomes and exact commit are reported after publication; physical-device testing remains unverified.
Next: Farmer request creation with validation and durable storage, then request list and edit/cancel.
