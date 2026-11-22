# v1.0.0 release checklist

## Local release preparation

- [x] `npm ci` works from the lockfile.
- [x] `npm run check` passes: strict types, lint, formatting, Workers/D1 tests and dry build.
- [x] `npm run openapi` is reproducible and matches the API.
- [x] `npm run db:generate` reports no schema changes.
- [x] Fresh local migrations, bootstrap, synthetic seed and HTTP requests verified.
- [x] Issue/revoke credential flow verified.
- [x] Dependencies and licenses reviewed; any residual advisory documented.
- [x] Source/configuration scanned for real secrets; generated state stays ignored.
- [x] README, architecture, examples, security policy and MIT license present.

The completed checks and exact results are recorded in [verification.md](verification.md). Remote checks and completion evidence are recorded below; future deployments and releases still require explicit owner authorization.

## Remote release preparation — owner-authorized 2026-11-22

- [x] Publish the complete source to [yunusgok/bookinghub-api](https://github.com/yunusgok/bookinghub-api) on `main`, following explicit owner approval.
- [x] Review the first CI run on GitHub and fix the optional-dependency lockfile mismatch it detected.
- [x] Active `main` ruleset requires pull requests, successful GitHub Actions `validate`, an up-to-date branch, and blocks deletion/force pushes; no bypass actors.
- [x] Verify private vulnerability reporting, dependency graph, Dependabot alerts and security-update PRs are enabled.
- [x] Review the existing owner account and Free-tier quotas; retain the Free plan and existing credentials/scopes. No paid upgrade or new external access granted.
- [x] Create remote D1 `bookinghub` (WEUR), configure its real database ID and allocate rate-limit namespace `1001` to BookingHub (2026-11-22).
- [x] Verify automatic 7-day D1 Time Travel; restore-test and encrypt a supplementary SQL snapshot; configure Workers Logs/metrics, query redaction, HTTPS workers.dev routing and disabled preview URLs. See operations.md.
- [x] Apply both remote migrations and provision the initial demo tenant/key; credential stored only in a Git-ignored, permission-restricted local file.
- [x] Deploy after explicit owner approval; pass 16 remote smoke checks including isolation and 8 simultaneous conflicting creates (one 201, seven 409).
- [x] Review remote evidence: functional portfolio deployment verified; no production-readiness, load, availability or independent audit claim.
- [x] Publish owner-authorized [v1.0.0](https://github.com/yunusgok/bookinghub-api/releases/tag/v1.0.0), verified public and pointing to deployed commit `851ff4b842fe38baf8e30c326acd79e8426dc52e`.

Published release: [BookingHub API v1.0.0](https://github.com/yunusgok/bookinghub-api/releases/tag/v1.0.0), 2026-11-22. Final Worker version: `b734804d-b79c-48d6-9c14-dc736f2b99b8`.

All items above are verified complete for this portfolio release. Future infrastructure, security and release changes still require their own review; no production, performance or coverage claim is implied.
