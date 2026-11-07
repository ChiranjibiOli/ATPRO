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
