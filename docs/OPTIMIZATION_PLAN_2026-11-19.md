# 2026-11-19 implementation plan: fixed-endpoint pickup optimization

Repository audit: main 3d646a38d3879167b14d0e11e34bd3c6dcdc77a8; CI success; no open issues. Existing single-request OSRM preview, coordinate capture, matching and weight allocation preserved. No multi-pickup optimizer exists.

## Slice 29: directed Clarke-Wright-inspired pickup merging (backend domain)
- Roles/goal: Farmer may eventually preview a feasible shared route; Driver may eventually accept it. This iteration exposes a **pure backend domain function only**, not a public API or mobile action.
- Input contract: ordered unique pickup IDs, directed nonnegative finite road distance/duration matrices, fixed driver start index 0, market index n-1, positive request kg, vehicle maximum kg, availability and perishability constraints passed as a validation callback.
- Action: initialize singleton routes, rank merges by *actual directed open-route saving* (cost of two D->...->M routes minus merged D->...->M route), merge only disjoint route ends, with both orientations evaluated. Deterministic ties.
- Validation/security: reject duplicate IDs, invalid matrix shapes, missing edges, unsafe weights and >23 pickups (25 OSRM points including endpoints). Caller must authenticate, authorize and sanitize data before invoking; no private coordinates in output.
- Entities: existing requests, vehicles, availability, matrix; no persisted trips or assignments.
- States: result with routes and unassigned reasons; invalid inputs throw typed errors; no loading/network state in pure function. Future API must distinguish loading, not-ready, OSRM errors and no eligible group.
- Acceptance/tests: fixed D/M, no duplicate pickups, directed asymmetric matrix, weight cap, compatibility callback, deterministic ties, no mutation; no claim of booking or globally optimal route.

## Slice 30: fixed-endpoint constrained 2-opt (backend domain)
- Roles/goal: same authorized planning context, improve each initial pickup order without moving driver start or destination market.
- Input/output: route pickup indices, same directed distance/time matrices and feasibility callback; return unchanged or shorter feasible route, total distance/duration, and number of accepted improvements.
- Actions: test all segment reversals, recompute full directed route cost, accept strict improvements only when hard constraints pass, repeat until local optimum with iteration cap.
- Validation/security: reject invalid/duplicate/out-of-range route indices and malformed matrices; no API exposure, storage, permissions change or new mobile button.
- States: feasible route or explicit rejection; no loading in pure function.
- Acceptance/tests: endpoints fixed, asymmetric costs correctly recomputed, never increase distance, no capacity or perishable constraint bypass, deterministic, nonmutation.

## Limitations and next pair
This is an isolated algorithmic foundation, not yet a multi-Farmer offer. A future authenticated orchestration layer must select compatible same-market/date requests, map OSRM coordinates, check arrival-time windows, max transit hours, weight and product co-loading, protect other Farmers' locations, and obtain Driver acceptance. Next pair: protected route candidate orchestration and mobile read-only multi-pickup summary. No Vercel, no paid services, no changes to e-selling.
