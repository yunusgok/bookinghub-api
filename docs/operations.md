# Deployment operations

## Verified portfolio deployment

Owner-authorized on 2026-11-22:

- Console: https://bookinghub-api.ynsmrgok.workers.dev/
- Swagger: https://bookinghub-api.ynsmrgok.workers.dev/docs
- Health: https://bookinghub-api.ynsmrgok.workers.dev/health
- Worker: `bookinghub-api`; HTTPS on the account's existing `ynsmrgok.workers.dev` subdomain. No unrelated custom domain or Worker was changed. Preview URLs are disabled.
- D1: `bookinghub`, WEUR, UUID `25969992-dc46-41d5-9582-55202111a1c3`; read replication remains disabled. Both schema and booking-guard migrations are applied.

This is a functioning, remotely smoke-tested portfolio instance. It has no production load, uptime SLA or independent security assessment. The root console is public; data operations require operator-provisioned credentials. Only synthetic demo records have been entered.

## Account access and GitHub controls

The initial release used the owner's existing Wrangler OAuth login and GitHub CLI login. Subsequently, the owner explicitly approved Cloudflare's managed `bookinghub-api build token` and native GitHub deployment connection. No collaborator, paid plan or external data-export destination was added. Human credentials and the managed build token must remain private. The managed token is stored by Cloudflare, never in repository files or GitHub Actions secrets.

The active GitHub `protect main` ruleset targets the default branch. It requires a PR, the `validate` check from GitHub Actions (App ID 15368), and an up-to-date branch. Force pushes/deletion are blocked and the bypass list is empty. A solo maintainer uses zero required human approvals. Private vulnerability reporting, dependency graph, Dependabot alerts and security-update PRs are enabled.

## Costs and quotas

The account was verified on Workers Free; no upgrade was purchased. The dashboard showed daily account limits of 100,000 Worker requests and 200,000 observability events. These quotas are shared with the account's other projects. D1 Free allows 5 million rows read/day, 100,000 rows written/day and 5 GB total storage; exceeding D1 daily limits causes queries to fail until reset, rather than automatically upgrading the plan. Rate limiting is approximate and regional, not a billing cap.

Sources checked 2026-11-22: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/). Cloudflare documents an observability pricing transition on 2026-12-01; review current terms and retention before changing plan or increasing usage. No claim of permanent zero operating cost is made.

## Monitoring and logs

`wrangler.jsonc` enables persisted Workers Logs at 100% sampling for this low-traffic portfolio instance. Invocation logs and tracing are disabled; query-string redaction is enabled. Application messages contain request ID, method, status and elapsed time only. Never log headers, credentials, customer data, SQL parameters or raw exceptions.

Use Cloudflare → Workers & Pages → `bookinghub-api` → Observability for logs and built-in request/error/CPU metrics. Correlate a client response's `X-Request-ID` with the log message. Current Free-plan stored-log retention is 3 days. Platform limits may stop collection when the daily event allowance is exhausted. There is no independent external uptime check, on-call notification service or 24/7 monitoring commitment.

For a temporary operator session:

```sh
npx wrangler tail bookinghub-api
```

A tail session may expose platform request metadata: do not paste its raw output publicly. Retained application logging is intentionally narrower.

## Backup and retention

D1 Time Travel is always enabled. The verified Free plan supplies a rolling 7-day history; no scheduled backup job or paid storage service is needed for that window. A pre-migration bookmark was obtained before applying the initial migrations. [D1 recovery documentation](https://developers.cloudflare.com/d1/reference/time-travel/).

A supplementary initial SQL export was restored into an isolated local SQLite database. `integrity_check`, `foreign_key_check`, the five domain tables and both booking-guard triggers were verified. The export was then encrypted with AES-256-GCM, its decrypt/encrypt round trip was checked, and the temporary plaintext file was removed.

Local owner-only artifacts (all ignored by Git):

- `.wrangler/credentials/bookinghub-owner.json`: initial tenant ID, key ID and API key, file 0600.
- `.wrangler/credentials/bookinghub-backup-key.json`: 256-bit backup encryption key, file 0600.
- `.wrangler/backups/bookinghub-v1-initial.enc.json`: encrypted initial snapshot, file 0600.
- `.wrangler/release/pre-migration-bookmark.json`: initial recovery bookmark.
- `.wrangler/release/remote-smoke.json`: sanitized live validation results.

Parent credential/backup directories have mode 0700. These files are local to the owner's computer and are not a replicated offsite backup. Move the operator key and backup key into an owner-managed secure vault if long-term recovery is required. Time Travel expires automatically; the supplementary release snapshot has no automated expiry and must be retired by the owner when superseded. Live customer records have no automatic deletion policy in v1; use synthetic data only until retention/erasure requirements are explicitly established.

To decrypt this snapshot locally, run from the repository root (the code does not print keys or SQL):

```sh
node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
const backup = JSON.parse(readFileSync('.wrangler/backups/bookinghub-v1-initial.enc.json', 'utf8'));
const secret = JSON.parse(readFileSync('.wrangler/credentials/bookinghub-backup-key.json', 'utf8'));
const decipher = createDecipheriv('aes-256-gcm', Buffer.from(secret.key, 'base64'), Buffer.from(backup.iv, 'base64'));
decipher.setAuthTag(Buffer.from(backup.tag, 'base64'));
const sql = Buffer.concat([decipher.update(Buffer.from(backup.ciphertext, 'base64')), decipher.final()]);
writeFileSync('.wrangler/backups/bookinghub-restored.sql', sql, { mode: 0o600, flag: 'wx' });
JS
```

Restore into a fresh local/test database first and check constraints/triggers before considering a remote import. The snapshot contains schema and synthetic records plus credential hashes, so keep the decrypted SQL private and remove it after use. Do not upload a plaintext export or a credential file as a release asset.

## Credential rotation

Use the CLI with `--remote` for this deployment:

```sh
npm run admin -- issue-key <tenant-uuid> --remote
# Update and verify clients using the replacement before revocation.
npm run admin -- revoke-key <old-key-uuid> --remote
```

The operator credential remains active for the demo tenant. Temporary isolation-smoke credentials were revoked after testing. Smoke bookings were cancelled; the isolation customer/service were deactivated. Synthetic history is retained by the documented soft-delete policy. Real keys must never be embedded in frontend assets, URLs, GitHub issues or release notes.

## Deployment and rollback

Make changes on a branch, open a PR, wait for required GitHub CI, and merge normally. Cloudflare Workers Builds automatically checks and deploys the resulting `main` commit. No administrative bypass or local deploy command is needed for ordinary main updates.

Before a migration, record a fresh bookmark and inspect the migration:

```sh
npx wrangler d1 time-travel info bookinghub --json
npm run db:migrate:remote
npm run deploy
```

Verify `/health`, `/`, `/docs`, authenticated CRUD, isolation, cancellation and conflicts. A release should record its Git commit and Worker version ID. For a code-only regression, inspect `npx wrangler deployments list` and use `npx wrangler rollback <known-good-version-id>` only after reviewing migration compatibility. A Worker rollback does not reverse D1 migrations.

For data recovery, identify the exact pre-change bookmark and stop incoming writes before an owner-authorized `wrangler d1 time-travel restore` operation. It rewinds data for all tenants in this shared database. Prefer an isolated restore rehearsal first. No remote production rewind was performed during initial release preparation.

## Automatic deployment

The owner approved the native Cloudflare GitHub connection and its managed build token on 2026-11-22. The saved Worker settings are:

| Setting                 | Value                                               |
| ----------------------- | --------------------------------------------------- |
| Repository              | `yunusgok/bookinghub-api`                           |
| Production branch       | `main`                                              |
| Build command           | `npm run check`                                     |
| Deploy command          | `npm run deploy`                                    |
| Root directory          | `/`                                                 |
| Node version            | `NODE_VERSION=24`                                   |
| Include / exclude paths | `*` / none                                          |
| Preview builds          | Disabled                                            |
| Build token             | `bookinghub-api build token`, managed by Cloudflare |

A push or merged PR reaching main triggers a production build, including documentation-only commits. The build runs the type, lint, formatting, Workers/D1 test and dry-run bundle checks before deployment. Failures stop the deploy. GitHub Actions still runs independently as a required PR check; it does not have production secrets or a deploy job.

The managed token's default permission scope is account-wide and includes Workers, D1, KV, R2, Queues and other platform services; it is not technically restricted to this Worker. That breadth was shown to the owner and explicitly approved before connection. Protect the main branch and build configuration accordingly. Revoke/replace the token in Cloudflare if compromised. The existing token for another project was not reused.

D1 migrations and tenant/key provisioning are not automatic. Review compatibility and apply a required migration before merging code that depends on it. Feature/PR branches do not build or deploy to the production database through this integration. No preview resources, webhook URL or broad token secret is published.

Inspect builds under Cloudflare → Workers & Pages → bookinghub-api → Deployments, and change the connection under Settings → Builds. Workers Builds uses the existing account's build quota; no paid upgrade was purchased. See [Cloudflare build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) and [branch behavior](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).
