# ADR 0001: enforce booking conflicts inside D1

Status: accepted; locally verified with workerd/D1.

## Context and source verification

V1 models one resource per tenant. Arbitrary minute durations make fixed slot allocation unnecessary and potentially lossy. Overlap must remain impossible when requests arrive together, without relying on a single Worker isolate.

Official platform references reviewed on 2026-11-21:

- [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/): auto-commit statements and transactional, sequential `batch()` with rollback on failure.
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): each database processes queries one at a time; quotas and maximum query duration still bound capacity.
- [D1 SQL compatibility](https://developers.cloudflare.com/d1/sql-api/sql-statements/) and [foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/): SQLite-based statements and enforced foreign keys.
- [SQLite triggers](https://www.sqlite.org/lang_createtrigger.html): per-row triggers and `RAISE(ABORT, ...)` terminate the offending statement.
- [Workers Vitest setup](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/): current plugin uses Vitest 4.1+; this project uses the compatible lockfile versions and the actual Workers runtime.
- [Native rate limiter](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/): approximate limits scoped to a Cloudflare location, not global quotas.

## Decision

Keep all tenants in one D1 database. Create triggers on booking INSERT and UPDATE. For active rows, reject inactive parents and test the overlap predicate against active bookings of the same tenant. Reject using named `RAISE(ABORT, ...)` messages mapped to safe API 409 responses. Composite FKs independently enforce tenant ownership, even for direct writes.

Inference from the documented execution model: because the guard and write are one atomic SQLite statement and D1 serializes queries, competing writers cannot both observe an empty slot and commit. Trigger support is additionally verified by applying the real migrations and writing through D1 in the supported testing environment.

We do not issue SQL `BEGIN` or call Drizzle interactive transactions, nor assume JavaScript can hold a D1 transaction open. A D1 batch could make known statements atomic, but a separate application-level check followed by an insert remains the wrong boundary. No overlap SELECT in application code authorizes a booking.

## Proof and limits

`tests/concurrency/bookings.test.ts` submits 12 overlapping HTTP creations and asserts one 201, eleven 409 responses, and exactly one persisted active booking. A second test concurrently writes eight rows directly through D1 and asserts one successful write; after cancellation/replacement it verifies UPDATE cannot reactivate the conflicting row and checks stored statuses. Another test permits the same time for two tenants. Integration tests verify adjacency, inactive parents, tenant references and slot reuse after cancellation.

Tests exercise real local D1 under workerd, not mocks. They prove observed behavior of the supported local runtime plus the invariant's structural enforcement; they are not a remote availability, load, or deployment claim. Run remote smoke tests after deployment is explicitly authorized. Direct database operators are trusted to preserve canonical UTC timestamp format; API validation enforces that representation. Cross-tenant isolation must continue to be checked in every new query.

## Alternatives

- SELECT then INSERT: rejected; there is an interleaving window.
- In-memory lock: rejected; separate isolates do not share it.
- Durable Object coordinator: possible, but adds state and routing complexity without strengthening this single-database invariant.
- Fixed slot table: possible for quantized intervals, but unnecessarily constrains minute durations.

The overlap index narrows by tenant/status/start. Very large booking histories still require capacity measurement; no throughput claim is made.
