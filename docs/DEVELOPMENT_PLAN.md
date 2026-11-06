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
