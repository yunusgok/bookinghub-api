# Security policy

This portfolio project's v1 receives fixes on its current main development line. There is no security certification, independent audit or production assurance.

## Report privately

Use GitHub private vulnerability reporting once the repository owner enables it. Until a private reporting channel is configured, do not publish exploit details, real credentials or personal data in public issues. The release checklist requires enabling private reporting; no nonexistent contact address is advertised here.

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

## Known limitations and dependency review

No credential scopes or expiration, centralized global throttling, idempotency keys, audit event storage, production monitoring or automated PII erasure. All keys for one tenant grant the same v1 permissions. Direct database operators must preserve canonical UTC values and migrations. Never remove triggers or disable foreign keys. No load or remote fault-injection assessment has been performed.

Drizzle Kit's stable development tooling includes deprecated esbuild-kit packages. A targeted npm override upgrades their esbuild to the patched version, and migration generation is verified after the override. Keep reviewing this override when upgrading Drizzle Kit. See `docs/verification.md` for actual audit results; no automatic downgrade or forced breaking audit fix is used.
