# Verification record

Verified locally on 2026-11-21, macOS arm64. Full check passed under Node **24.22.3** (CI's configured LTS major); initial development used Node 25.2.0 and npm 11.6.2. Cloudflare Workers tests ran in workerd with real local D1 bindings through `@cloudflare/vitest-plugin` 1.9.0 and Vitest 4.1.12. No database mocks were used for invariant tests.

| Check                                 | Observed result                                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Clean dependency install and `npm ci` | Passed with lockfile and targeted override                                                               |
| `npm run typecheck`                   | Passed, strict mode with unchecked index checks                                                          |
| `npm run lint`                        | Passed                                                                                                   |
| `npm run format:check`                | Passed; includes YAML syntax parsing                                                                     |
| `npm test`                            | **31 passed**, 3 files, no skipped tests                                                                 |
| `npm run build`                       | Passed; Wrangler dry run, no upload/deploy                                                               |
| `npm run db:migrate`                  | Both migrations applied to fresh local D1                                                                |
| `npm run db:generate`                 | No schema changes; before/after file hashes equal                                                        |
| `npm run openapi`                     | Byte-for-byte repeatable checked-in specification                                                        |
| `npm run smoke:local`                 | Passed against a running local Worker over HTTP                                                          |
| `npm audit`                           | **0 known vulnerabilities**, full dependency tree                                                        |
| Source secret-pattern scan            | No full API keys, private key headers, AWS access key IDs or GitHub tokens found in source/configuration |
| Git ignore checks                     | node_modules, local D1 state, dist, .dev.vars and .env ignored                                           |
| Dependency/license review             | Runtime packages MIT / Apache-2.0; development license details in dependencies.md                        |

## What the tests establish

- Validation rejects invalid durations, malformed dates, unknown fields, empty updates and invalid identifiers; calculations cross UTC date boundaries correctly.
- Authentication rejects missing, malformed, invalid and revoked credentials. Customer/service CRUD, soft deletion, paging and booking filters work.
- Foreign tenant IDs are hidden on reads/mutations; lists exclude foreign rows. Direct D1 writes cannot use another tenant's customer/service pair.
- Twelve simultaneous overlapping API creates yield exactly one 201 and eleven 409 responses, with exactly one active row stored.
- Eight concurrent direct D1 inserts yield exactly one success. Reactivation cannot restore a conflicting booking. D1 batch errors roll back preceding writes.
- Inactive parents are rejected by the database even after an earlier caller read. Adjacent bookings are accepted, cancelled intervals are reusable and independent tenants can share the same wall-clock slot.
- Error handling returns safe responses; request limits and rate-limit denial paths are tested. Partial service updates preserve omitted active/duration fields (a regression caught and fixed during implementation).

## Live local smoke test

The smoke script provisioned a tenant and key using the CLI, issued a replacement key, seeded synthetic data, started Wrangler on local port 8788, retrieved resources, created/conflicted/cancelled a booking and submitted eight concurrent conflicting HTTP requests. It observed one success and seven conflicts. Revoking the original credential yielded 401, while the replacement remained valid. Both smoke credentials were revoked and the local Worker was stopped afterward. Credentials were captured in memory and withheld from logs.

## Scope of evidence

Local CI-equivalent commands, generated artifacts and local runtime behavior are verified. The original local verification preceded publication; hosted CI evidence is recorded in the publication section below. The workflow uses read-only permissions, requires no production credentials and includes no deployment step. No remote migrations, remote smoke tests, account configuration, load tests or disaster-recovery exercise were performed. No coverage percentage, production usage or throughput is claimed. Secret scans are heuristic; review the publishable diff as a final owner step.

All required local acceptance checks passed. The subsequent public GitHub publication was explicitly authorized; Cloudflare deployment and tagged release remain separate manual gates.

## Swagger UI follow-up

Added public `/docs` using @hono/swagger-ui 0.6.2 and pinned Swagger UI 5.35.1 CDN assets. The browser rendered the API, resource groups, schemas and Authorize control correctly. The specification uses the current origin, and credentials are not persisted. Full `npm run check` passes with **32 tests** after this change (Node 25.2.0). Package installation reported zero known vulnerabilities.

## Public GitHub publication

On 2026-11-21 the owner explicitly authorized public publication. The repository was created at [yunusgok/bookinghub-api](https://github.com/yunusgok/bookinghub-api), verified as **PUBLIC**, and `main` was pushed with the full source, migrations, tests, CI, MIT license and a detailed README. The initial implementation commit is `de4dfbec7b2c4890f14c7eb36a00644a2ccb0cc3`.

The exact 53 staged files were scanned before publication: no credential-pattern matches, local D1 state, `.env` files, dependencies or generated bundles were included. README local links and the end-to-end shell example's syntax were checked. Local `npm run check` passed with all **32 tests**. No Cloudflare deployment or tagged GitHub release was performed.

The first hosted [CI run](https://github.com/yunusgok/bookinghub-api/actions/runs/44925576138) caught missing optional WASM dependency entries in the lockfile produced by local npm 11.6.2. The lockfile was repaired in an empty temporary directory using the runner's npm 11.19.1, and `npm ci --dry-run --ignore-scripts` validated the completed tree. Application dependency versions were retained. The [Actions page](https://github.com/yunusgok/bookinghub-api/actions) and README status badge show the current hosted validation result.
