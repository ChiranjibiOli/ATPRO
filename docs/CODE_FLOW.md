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
