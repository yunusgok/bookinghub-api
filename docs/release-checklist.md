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

The completed checks and exact results are recorded in [verification.md](verification.md). Unchecked remote tasks below are deliberate manual release gates, not local feature placeholders.

## Requires owner approval / external configuration

- [x] Publish the complete source to [yunusgok/bookinghub-api](https://github.com/yunusgok/bookinghub-api) on `main`, following explicit owner approval.
- [x] Review the first CI run on GitHub and fix the optional-dependency lockfile mismatch it detected.
- [ ] Configure required checks/branch protection.
- [ ] Enable GitHub private vulnerability reporting and dependency update alerts.
- [ ] Review Cloudflare account, access policy, quotas and potential charges.
- [ ] Create/select remote D1; replace placeholder database ID and reserve rate-limit namespace.
- [ ] Configure backups, retention, monitoring, routes and TLS.
- [ ] Apply remote migrations and provision initial tenant/keys securely.
- [ ] Deploy only after explicit approval; run remote smoke, isolation and conflict tests.
- [ ] Review remote operational evidence before describing any deployment as production-ready.
- [ ] Create the v1.0.0 Git tag/release only after explicit approval.

Suggested release title: `BookingHub API v1.0.0 — tenant-isolated booking backend`.

Suggested release notes: Initial API with tenant-isolated customer/service management, hashed revocable API keys, atomic D1 booking conflict prevention, OpenAPI and Workers-runtime tests. See README and SECURITY.md for limitations and operator configuration. Do not add unverified production, performance or coverage claims.
