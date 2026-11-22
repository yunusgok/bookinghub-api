# Security policy

This portfolio project's v1 receives fixes on its current main development line. There is no security certification, independent audit or production assurance.

## Report privately

Private vulnerability reporting is enabled. [Report a vulnerability privately](https://github.com/yunusgok/bookinghub-api/security/advisories/new). Do not publish exploit details, real credentials or personal data in public issues. Dependabot alerts and security-update PRs are enabled.

## Controls and trust boundaries

- Web Crypto generates 256-bit random API keys. Only SHA-256 digests are stored. High entropy makes unsalted fast hashing appropriate for these machine credentials; this design must not be reused for human passwords.
- Authentication looks up the complete fixed-length digest using a parameterized indexed query; application code does not compare a secret byte by byte. No constant-time string comparison is needed on this path. Database lookup timing is not claimed to be constant-time. Credentials have uniform 401 responses and are rate-limited.
- Every resource query includes the authenticated tenant. Composite foreign keys prevent foreign customer/service references, including outside route handlers. UUIDs are identifiers, not authorization.
- Atomic database triggers prevent conflicting active bookings. Tests cover direct writes, concurrent HTTP requests and update reactivation.
- Strict schemas reject unknown body/query fields and invalid durations/dates. SQL values are parameterized. Request bodies are limited to 16 KiB, including streaming bodies.
- Native Workers rate limits run per IP before database authentication and per tenant after authentication. Limits are approximate and per location; they do not prevent all distributed abuse or guarantee billing limits.
- Responses include security headers, `no-store` and generated request IDs. Clients receive safe error codes, never stack traces or SQL details. Logs include only request ID, method, status and elapsed time, with no raw exceptions, keys, customer fields or request paths.
- Administrative operations exist only in a local-first CLI; no public tenant/key creation endpoint exists. Restricted temporary SQL files hold hashes only and are removed in `finally`. API keys are displayed once to the operator after successful creation.

## Configuration and operations

Keep `.dev.vars`, `.env`, API keys, Cloudflare tokens and local `.wrangler` state out of version control. Use a password manager for credentials and Cloudflare secrets/environment configuration for future application secrets. Never add plaintext keys to examples or CI. Use TLS remotely and share keys through a secure channel. Do not embed tenant keys in browser bundles.

For rotation, issue a replacement, verify clients using it, then revoke the old key ID through the operator CLI. Revocation is checked on every subsequent request against primary D1; in-flight authenticated requests may complete. Read replication is not enabled. A compromised database digest does not reveal a random 256-bit key, but database administrator access is fully trusted and must be tightly scoped.

Soft deletion retains personal data and existing bookings; it is not erasure. Define retention/export/deletion, encrypted backup handling, restore testing and log retention before real use. A future compliance workflow must consider backup copies and legal retention. Platform access, routes, TLS configuration, secret delivery and backup policy remain operator responsibilities.

## Browser console

The root test console is public static UI; all data requests still require a valid tenant credential. It is a developer tool with real write access, not an anonymous public demo. Users enter their own API key at runtime. It stays in JavaScript memory and is not persisted in localStorage, sessionStorage, cookies or URLs. Disconnect/navigation clears credentials and rendered tenant data and aborts in-flight requests. Do not hardcode a shared key in the source or provide real tenant keys to public visitors.

Only self-hosted code and styles load in this console; a restrictive CSP is applied through static asset headers. Backend fields render as text rather than HTML, and authorization headers never appear in the response inspector. The existing `/docs` Swagger page remains separate and retains its documented external asset dependency.

## Known limitations and dependency review

No credential scopes or expiration, centralized global throttling, idempotency keys, audit event storage, external uptime alerting or automated PII erasure. All keys for one tenant grant the same v1 permissions. Direct database operators must preserve canonical UTC values and migrations. Never remove triggers or disable foreign keys. No load or remote fault-injection assessment has been performed.

Drizzle Kit's stable development tooling includes deprecated esbuild-kit packages. A targeted npm override upgrades their esbuild to the patched version, and migration generation is verified after the override. Keep reviewing this override when upgrading Drizzle Kit. See `docs/verification.md` for actual audit results; no automatic downgrade or forced breaking audit fix is used.

## Deployment operations

Workers Logs and platform metrics are enabled for the deployed portfolio instance. Invocation logs and traces are disabled, and query strings are redacted at the platform configuration boundary. Application logs retain the metadata-only policy above. The initial operator API key and backup decryption key are stored only under ignored `.wrangler/credentials/`, with directory permissions 0700 and file permissions 0600. They are never distributed with the frontend, repository or release. See [operations](docs/operations.md) for backup, access, retention and rollback procedures.

## Git-connected deployment

The protected main branch is connected to Cloudflare Workers Builds. Production builds run `npm run check` before `npm run deploy`; feature and PR preview builds are disabled. Cloudflare stores the owner-approved managed build token. It is an account-wide platform token, not a per-Worker credential, so changes to main/build commands must be reviewed with that scope in mind. No deploy token is stored in the repository or GitHub Actions. Automatic deployment does not run D1 migrations, bootstrap tenants or seed data.
