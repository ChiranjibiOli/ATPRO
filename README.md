# ATPRO — Agricultural Transport Route Optimization

Android-first mobile application for a BCA academic capstone. ATPRO is designed to match compatible farmers' transport requests with available drivers, allocate vehicle capacity, and find feasible pickup routes to a single destination market.

## Implemented now

1. A mobile landing screen that explains the agricultural transport workflow, with working navigation.
2. A Farmer / Driver / Admin role explorer with on-device preference saving, restoration, changing and clearing.

This first version is a public Expo prototype. Selecting a role is NOT registration or authentication. There is no real booking, login, operating backend, database, optimization, live GPS, APK or hosted live preview in this commit.

## Run on an Android phone

Requires Node.js 22.13+, npm, internet access for first installation, and Expo Go installed on the phone.

    cd apps/mobile
    npm install
    npm run start

Scan the terminal QR code using Expo Go while laptop and phone are on the same Wi-Fi network. If LAN is blocked, try the optional command: npx expo start --tunnel.

## Verify

    cd apps/mobile
    npm test
    npm run typecheck

The pure role and storage-contract suite runs with Node 22+ without installing packages. Type checking and mobile execution require dependencies and actual Expo Go or emulator use. GitHub Actions validates the project when runners can install those dependencies.

## Architecture

- Mobile: React Native, Expo SDK 58, TypeScript.
- Backend, planned: Node.js, server-side RBAC, PostgreSQL.
- Mapping, planned: OSM and OSRM road distances/times; honor public server usage policies.
- Algorithms, planned: constraint-aware vehicle matching, adapted Clarke-Wright pickup route construction, feasible 2-opt with driver starting point and destination market fixed.
- Roles: Farmer, Driver, Admin only. Cooperative help is possible without creating a fourth privileged role.
- Vehicle requirements: body/type, weight and volume limits, product compatibility, perishability, availability and requested market/date.
- Transport workflow: request, matching proposal, driver acceptance, trip assignment, individual pickup confirmations and delivery.

See docs/PAGE_SPEC.md, docs/ARCHITECTURE.md, docs/DEVELOPMENT_PLAN.md, docs/CODE_FLOW.md and docs/PROGRESS.md.

No paid infrastructure is required for local development. Production hosting, SMS and high-volume routing may still cost money.

This repository is independent of the user's previous e-selling project.

## Registration and login (2026-11-06)

API-backed Farmer/Driver registration and login prototype now live in apps/api and apps/mobile. No public Admin registration. Roles come from server, never local role preference. Uses single-process atomic JSON file storage, salted scrypt password hashes and hashed, expiring bearer tokens. This is NOT production-ready or hosted.

Local setup (Node.js 22+):
1. Terminal A: `cd apps/api && npm test && npm start`. Default API binds to 127.0.0.1.
2. For Android testing on a trusted private Wi-Fi, explicitly bind to LAN: `HOST=0.0.0.0 npm start` (PowerShell: `$env:HOST="0.0.0.0"; npm start`). Stop after testing.
3. In apps/mobile, copy .env.example to .env and replace example IP with laptop LAN IPv4. Run `npm install && npm start`. Scan QR with Expo Go. Restart after .env changes.
4. Register, sign in, restart and test session restore, log out. Use disposable passwords on HTTP LAN only.

No real email verification, password reset, Admin provisioning, PostgreSQL, APK or public HTTPS endpoint. Expo Go is a local preview, not a public hosted URL.
