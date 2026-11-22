# BookingHub: preventing booking conflicts across independent businesses

**Independent portfolio project · TypeScript backend development · Cloudflare deployment**

BookingHub demonstrates the delivery of a booking backend for appointment-based businesses: customer records, services and reservations, with separate data for each business. It includes a working API, a browser console, interactive documentation, automated tests and a deployed service.

[Live console](https://bookinghub-api.ynsmrgok.workers.dev/) · [Interactive API documentation](https://bookinghub-api.ynsmrgok.workers.dev/docs) · [Source code](https://github.com/yunusgok/bookinghub-api) · [CI results](https://github.com/yunusgok/bookinghub-api/actions/workflows/ci.yml)

## The business problem

Consider two yoga studios using the same platform. Each needs private customer records and a schedule that rejects conflicting reservations, even when requests arrive together. Cancelled appointments should free their time slots.

BookingHub demonstrates that workflow using synthetic data. It is an independent portfolio project; no commercial client engagement or customer adoption is claimed.

## Delivery scope

The project covers system design, implementation, verification and deployment:

- **Customer and service management:** create and update records, paginate lists, set service durations and deactivate records while preserving booking history.
- **Booking workflow:** calculate end times, reject conflicting appointments, filter reservations and release time slots after cancellation.
- **Business separation:** derive the business identity from authenticated credentials and enforce ownership in both queries and database relationships.
- **Integration and handover:** provide a versioned REST API, Swagger/OpenAPI, example requests, local setup instructions and an operations runbook.
- **Deployment workflow:** validate pull requests, protect the main branch, and automatically check and deploy merged main changes through Cloudflare Workers Builds.

The stack is TypeScript, Hono, Zod, Drizzle ORM and Cloudflare D1 on Workers, with a browser console for the API workflow.

## Two decisions that matter to a client

### Keep each business's data separate

The API determines the tenant from a revocable API key. Clients cannot switch businesses by submitting a tenant ID. Every resource query includes the authenticated tenant, and composite foreign keys prevent a booking from referencing another tenant's customer or service.

Tests exercise cross-tenant reads, updates, deactivation, cancellation and booking references at both enforcement points.

### Enforce booking conflicts inside the database write

Checking availability and then inserting a booking in a separate operation leaves a window where another request can reserve the same slot.

BookingHub checks for overlaps in database triggers executed within booking INSERT and UPDATE statements. The database rejects a conflicting active booking with an error mapped to HTTP 409. Cancellation makes the interval available again; adjacent appointments are allowed.

The [design decision](decisions/0001-d1-atomic-bookings.md) explains the execution model, alternatives and tests. This is the central correctness decision in the project.

## Observed results

Verification recorded on **22 November 2026**:

| Evidence                    | Observed result                                                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automated suite             | 32 tests passed, covering validation, API workflows, authentication, tenant isolation and concurrency in the Workers runtime.                                                      |
| Local D1 concurrency test   | 12 overlapping API creates produced one success and eleven conflicts, with one active booking persisted.                                                                           |
| Deployed concurrency check  | Eight simultaneous conflicting requests produced one HTTP 201 and seven HTTP 409 responses, with one active booking observed before cleanup.                                       |
| Remote database consistency | No active overlap pairs or foreign-key violations were found; both booking-guard triggers were present.                                                                            |
| Automatic delivery          | A merged main commit triggered Cloudflare checks and deployment without a local deploy command; the deployed health endpoint and authenticated customer listing returned HTTP 200. |

The tests use actual local D1 bindings, and the deployed check uses the live service. No throughput benchmark or uptime guarantee is claimed. Sources: [verification record](verification.md), [concurrency tests](../tests/concurrency/bookings.test.ts) and [operations runbook](operations.md).

## Review the project in three minutes

1. Open the [Swagger documentation](https://bookinghub-api.ynsmrgok.workers.dev/docs) to inspect the API and its request/response contracts.
2. Read the [booking design decision](decisions/0001-d1-atomic-bookings.md) and the concurrency test to see how scheduling correctness is enforced and verified.
3. Open the [console](https://bookinghub-api.ynsmrgok.workers.dev/) to inspect the interface. An interactive data walkthrough requires an operator-provisioned tenant key and uses synthetic records. No shared visitor credential is published.

A useful walkthrough is: create a customer and a 30-minute service, reserve a time, attempt a conflicting reservation, cancel the original booking, and reserve that time again.

## Relevance to freelance work

This project is a reference for TypeScript REST API development, appointment workflows, multi-tenant SaaS data models, SQL business rules, automated testing, API documentation and Cloudflare delivery.

Client discovery would establish bookable resources, time zones, access rules and existing integrations before defining scope and acceptance criteria.

V1 supports one bookable resource per business and UTC timestamps. Payments, notifications, calendar synchronization, automated personal-data erasure and external uptime alerting are outside its scope. A client deployment would require its own operational requirements, access review and capacity assessment.
