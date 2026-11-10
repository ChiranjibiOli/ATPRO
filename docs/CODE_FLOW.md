# Mobile Code Flow Manual

1. Expo loads apps/mobile/App.tsx through expo/AppEntry.js.
2. App initializes home screen, no selected browsing role and loading state.
3. createRolePreferenceStore(AsyncStorage) reads atpro.public.role.v1; isRoleId validates exactly farmer, driver or admin. Missing/corrupt value means no selection.
4. HomeScreen explains the transport workflow and its Explore user roles action calls App.setScreen('roles').
5. RolesScreen maps ROLE_DEFINITIONS into accessible touch selectors. A tap invokes chooseRole from App.
6. App updates the visible selected role immediately, serializes an AsyncStorage write, and renders the relevant responsibilities.
7. If persistence fails, show a warning while keeping the selection for the current app session. No backend request or account creation occurs.
8. Clear role preference resets the UI and calls removeItem; Back to home changes the screen without creating any account.
9. HomeScreen displays the currently selected role as an optional browsing interest.

Tests in apps/mobile/tests/roles.test.mjs verify exact role definitions, valid/invalid IDs, storage default, save, replace, reload, clear and storage errors. Run npm test from apps/mobile using Node 22+. For native UI verification, install dependencies, start Metro and scan Expo Go QR on Android.

SECURITY: role preference is not a permission. Actual Farmer/Driver/Admin screens and data access will require secure server-backed authentication, ownership checks and authorization in later iterations.

## 2026-11-06 authentication code flow

App.tsx exposes Create account and Sign in. AuthScreen.tsx handles Farmer/Driver registration with name/email/password/confirmation, or login with email/password. It validates locally and calls src/auth/client.ts with EXPO_PUBLIC_API_URL. POST /api/auth/register validates again, hashes password using salted scrypt, saves user in serialized atomic JSON storage. POST /api/auth/login validates hash, issues 256-bit bearer token, stores SHA-256 token digest and expiry. App saves token in expo-secure-store and GET /api/auth/me restores server-confirmed identity after restart. AccountScreen displays identity and POST /api/auth/logout revokes session then clears secure token. API router: apps/api/src/app.js; crypto: auth.js; storage: store.js; local launcher: server.js. apps/api/tests/auth.test.js covers registration, duplicates, invalid Admin, hashing, bad login, session and logout.

## 2026-11-07 Farmer dashboard

After login or session restore, App uses the authenticated user's server-supplied role. Farmer opens FarmerDashboardScreen; Driver/Admin remain in AccountScreen. FarmerDashboardScreen calls GET /api/farmer/overview with the bearer token. Server checks the session and role, then counts only requests owned by that Farmer and trips assigned to their requests. 401 clears the mobile token and navigates to login; 403/network failures show an error and retry control; zero records display an honest empty state. Logout uses the existing API session revocation flow.

## 2026-11-08 Farmer request flow
1. Authenticated Farmer dashboard calls GET /api/farmer/overview and GET /api/farmer/requests with its secure token; backend filters by authenticated user.
2. Create transport request opens CreateRequestScreen; required product, category, handling, weight, pickup address, destination market, Nepal pickup date/time and max transit hours are entered. No fourth role or driver assignment.
3. Form performs basic client checks, then POST /api/farmer/requests with bearer token. Backend rechecks session and Farmer role; validates all fields and future pickup time in Nepal local time; discards any injected farmerId/status.
4. JsonStore.transaction appends server-generated pending request to db.requests, returning 201 with saved record. Validation failure returns 400 fields; 401 logs out expired session, 403 rejects non-Farmer, network failure retains form input.
5. Success returns to Farmer dashboard. New mount fetches real counts and persisted requests; cancellation returns without saving. No driver is automatically assigned or accepted.
6. API integration tests cover Nepal date parsing, invalid fields, unauthorized and Driver access, cross-Farmer isolation, injected owner/status ignored, persisted record and dashboard count update.

## 2026-11-09 Farmer request detail/edit/cancel
FarmerDashboardScreen lists owner-scoped requests and passes selected ID to App, which opens RequestDetailScreen. GET /api/farmer/requests/:id retrieves full details and current revision after token/role/ownership checks. Edit opens CreateRequestScreen with the request's values, converts pickupAt to Nepal civil date/time, and sends PATCH with complete validated fields plus revision. The API checks pending status and revision inside the JSON transaction and returns 409 if stale. Cancellation requires a separate confirmation and POST /api/farmer/requests/:id/cancel with revision; it sets status cancelled and retains the record. Returning to dashboard reloads real request counts and statuses. Only pending requests expose edit/cancel actions. Errors remain visible and no records are silently deleted.
