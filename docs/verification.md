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

## Browser test console follow-up — 2026-11-22

Added a same-origin test console at `/` using Wrangler Static Assets and local HTML/CSS/JavaScript. No npm dependencies were added. The existing API and Swagger routes remain Worker-handled. The complete `npm run check` passes with **32 tests**, including type checking, lint, formatting and the asset-enabled dry-run build. No deployment or GitHub push was performed for this follow-up.

A disposable Chromium browser exercise against the running local Worker and actual local D1 verified invalid/valid authentication, customer creation/editing, service creation/deactivation/reactivation, UTC booking end calculations, 201/409 conflict behavior, cancellation and slot reuse, status filters, multi-page customer lists, response inspection, tenant switching, disconnect and reload. User-provided markup rendered as text without creating elements or executing handlers. It also verified no localStorage/sessionStorage credentials, restrictive static CSP, missing-asset 404 behavior and authenticated API routing. Desktop (1440px) and mobile (390px) screenshots were inspected; mobile had no horizontal overflow and no JavaScript page errors were observed. Browser test tenants used synthetic data and their API keys were revoked afterward. Temporary browser tooling was installed outside the repository and is not an application dependency.

## Remote D1 configuration — 2026-11-22

Following explicit owner authorization, created remote D1 `bookinghub` with database UUID `25969992-dc46-41d5-9582-55202111a1c3` using the WEUR location hint. Set `account_id` and replaced the placeholder `database_id` in `wrangler.jsonc`. A remote D1 info read confirmed WEUR placement, disabled read replication and zero tables. No jurisdiction restriction was requested or configured.

Read the settings of the account's two deployed Workers; neither exposed a rate-limit binding. Allocated namespace `1001` to BookingHub in project configuration/documentation, keeping 120 requests per 60 seconds. Cloudflare's native rate-limit namespaces are operator-chosen identifiers, so this allocation is a project record rather than a separate globally enforced reservation. See the [official binding documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

`npm run build` passed with the D1 and rate-limit bindings and existing frontend assets. Formatting checks passed for changed configuration/documentation. No remote migrations, tenant/key provisioning, deployment, Git commit or GitHub push was performed in this step.

## Owner-authorized remote release — 2026-11-22

The owner authorized completing all release-checklist steps, including remote migrations, credential provisioning, deployment and v1.0.0 release publication. Earlier statements about operations not yet performed describe the preceding preparation phases; this section records the subsequent live verification.

GitHub private vulnerability reporting, dependency graph, Dependabot alerts and security-update PRs were verified enabled. The existing `protect main` ruleset had an empty required-check list; it now requires `validate` from GitHub Actions App ID 15368 and an up-to-date branch. PR-only changes, force-push/deletion protection and an empty bypass list remain in effect. Implementation [PR #1](https://github.com/yunusgok/bookinghub-api/pull/1) passed both hosted validation runs and merged normally.

All 32 local tests, strict type checks, lint, formatting and the frontend-enabled build pass. Both migrations were applied to remote D1. The owner's initial demo credential is stored only in an ignored 0600 local file under a 0700 directory. No credential was committed or embedded in frontend assets.

Initial deployment: `34b668d`, Worker version `3ed857ea-825c-43dc-84f1-7a4b4a5dc8e4`, HTTPS origin https://bookinghub-api.ynsmrgok.workers.dev/. The browser rendered the public console successfully. D1/limiter bindings, disabled read replication, persisted application logs, disabled invocation logs/traces, enabled workers.dev routing and disabled preview URLs were verified from deployed Worker settings. The final preparation additionally redacts query strings and replaces the console's local-only key-bootstrap hint with operator guidance.

### Live smoke and database consistency

- HTTPS health and request IDs.
- Browser console and static CSP.
- Static assets, Swagger and OpenAPI.
- Authentication enforced.
- Customer/service create, retrieve and updates.
- Pagination.
- Cross-tenant reads, lists, updates, deletes and references blocked.
- 8 concurrent conflicting creates: 1 created, 7 conflicts, 1 persisted.
- Cross-tenant booking access blocked.
- Cancellation frees slot, repeated cancellation, calculated duration and adjacency.
- Independent tenants can book same slot.
- Booking filters.
- Deactivation and inactive-service enforcement.
- Validation.
- Remote key revocation.
- Remote D1: no active overlaps, no foreign-key violations, both guards present.

The race test sent eight simultaneous overlapping requests over HTTPS: one returned 201 and seven returned 409; exactly one active booking was observed before cleanup. A remote D1 consistency query found zero overlapping active pairs, zero foreign-key violations and both guard triggers. All smoke bookings were cancelled; isolation customer/service records were deactivated and their credential revoked. The owner demo customer/service remain available using the privately held operator credential.

### Recovery and operations evidence

A pre-migration Time Travel bookmark was recorded. A supplementary remote SQL export was restored into isolated local SQLite; integrity, foreign keys, five domain tables and both guard triggers passed verification. AES-256-GCM encryption/decryption round-trip verification passed, and the temporary plaintext export was removed. Backup and encryption key are restricted, ignored local artifacts; neither is a release asset. D1's managed Free-plan backup window is seven days; current stored Workers Logs retention is three days. See [operations](operations.md) for sources, quotas, the upcoming observability pricing review, local-artifact retention, key rotation and recovery boundaries.

Live log correlation matched a successful HTTPS health response's `X-Request-ID` to its application log stream. Raw tail output was neither retained nor published. No paid plan upgrade, external alerting subscription, unrelated custom-domain change, account collaborator or new token scope was introduced. There is no load-test, SLA, full disaster-recovery or production-readiness claim.

### Final release publication

Release-preparation [PR #2](https://github.com/yunusgok/bookinghub-api/pull/2) passed both required hosted CI runs and merged normally. Deployed source commit: `851ff4b842fe38baf8e30c326acd79e8426dc52e`; final Worker version: `b734804d-b79c-48d6-9c14-dc736f2b99b8`. Remote settings confirmed query-string redaction enabled, invocation logs disabled and application logs persisted. Final HTTPS health, root console and authenticated customer listing returned 200; the browser displayed the corrected operator-key guidance.

[BookingHub API v1.0.0](https://github.com/yunusgok/bookinghub-api/releases/tag/v1.0.0) was published on 2026-11-22 at 19:50:51 UTC, with `isDraft=false` and `isPrerelease=false`. Both the remote Git tag and release target were verified to point to the deployed source commit above. No credential, SQL snapshot, encryption key or raw log was uploaded as a release asset.

This final follow-up records checklist completion only; it does not change the tagged/deployed application code. All release-checklist items are complete for this portfolio deployment. External alerting, load assessment, offsite export replication and automated PII erasure remain explicitly documented future operational work rather than claimed features.

## Native GitHub → Cloudflare deployment verification

On 2026-11-22 the owner explicitly approved Cloudflare's managed, account-wide build token and completed the repository connection. The saved settings were verified in the dashboard: repository `yunusgok/bookinghub-api`, production branch `main`, root `/`, Node 24, build command `npm run check`, deploy command `npm run deploy`, include path `*` with no exclusions. Preview branch builds were verified disabled.

[PR #5](https://github.com/yunusgok/bookinghub-api/pull/5) passed required GitHub CI and merged as commit `fd466055f9934aafbddbedf0eb560ea2396fe6e1`. Without any local Wrangler deploy, GitHub reported the native `Workers Builds: bookinghub-api` check running and then completed successfully. [Cloudflare build 1922a390](https://dash.cloudflare.com/6657c00f42c43bd85fe80fce5bc78aae/workers/services/view/bookinghub-api/production/builds/1922a390-0c71-4c2d-8777-082293df6bd3) used Node 24.22.3, installed dependencies from the lockfile, ran the configured checks and deployed Worker version `37dcb25c-bd41-47b0-90bb-240577b53a2c`.

The dashboard showed that exact main commit with source Build, status Ready, and 100% traffic on the new version. The Workers deployment API independently confirmed the active version and 100% allocation. HTTPS `/health` and an authenticated `/v1/customers` request both returned 200 after the automatic deployment. No production migration or seed command was part of the automatic build. No deploy credential was added to source or GitHub secrets.

The native Cloudflare workflow is distinct from GitHub Actions validation: PRs must pass the protected-branch check before merging, and Cloudflare independently validates/deploys main updates. The approved managed token's broad account scope is documented in [operations](operations.md#automatic-deployment).
