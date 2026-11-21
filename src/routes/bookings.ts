import { Hono } from 'hono';
import { and, eq, asc, gte, lt } from 'drizzle-orm';
import type { AppEnv } from '../lib/types';
import { database } from '../repositories';
import { bookings, customers, services } from '../db/schema';
import { bookingInput, bookingQuery } from '../schemas/input';
import { body, found, resourceId } from '../lib/http';
import { ApiError } from '../lib/errors';
import { endTimestamp } from '../services/booking';
export const bookingsRoutes = new Hono<AppEnv>();
bookingsRoutes.post('/', async (c) => {
  const input = await body(c, bookingInput);
  const db = database(c.env.DB);
  const tenantId = c.get('tenantId');
  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.id, input.customerId)),
    )
    .limit(1);
  const [service] = await db
    .select()
    .from(services)
    .where(
      and(eq(services.tenantId, tenantId), eq(services.id, input.serviceId)),
    )
    .limit(1);
  found(customer);
  found(service);
  if (!customer!.active || !service!.active)
    throw new ApiError(
      409,
      'inactive_reference',
      'Customer or service is inactive.',
    );
  const now = new Date().toISOString();
  // The INSERT trigger, not these reads, owns the overlap and activation invariants.
  const [row] = await db
    .insert(bookings)
    .values({
      ...input,
      tenantId,
      id: crypto.randomUUID(),
      endAt: endTimestamp(input.startAt, service!.durationMinutes),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  c.header('Location', `/v1/bookings/${row!.id}`);
  return c.json({ data: row }, 201);
});
bookingsRoutes.get('/', async (c) => {
  const q = bookingQuery.parse(c.req.query());
  const filters = [eq(bookings.tenantId, c.get('tenantId'))];
  if (q.status) filters.push(eq(bookings.status, q.status));
  if (q.customerId) filters.push(eq(bookings.customerId, q.customerId));
  if (q.serviceId) filters.push(eq(bookings.serviceId, q.serviceId));
  if (q.from) filters.push(gte(bookings.startAt, q.from));
  if (q.to) filters.push(lt(bookings.startAt, q.to));
  const rows = await database(c.env.DB)
    .select()
    .from(bookings)
    .where(and(...filters))
    .orderBy(asc(bookings.createdAt), asc(bookings.id))
    .limit(q.limit + 1)
    .offset(q.offset);
  return c.json({
    data: rows.slice(0, q.limit),
    pagination: {
      limit: q.limit,
      offset: q.offset,
      hasMore: rows.length > q.limit,
    },
  });
});
bookingsRoutes.get('/:id', async (c) => {
  const [row] = await database(c.env.DB)
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantId, c.get('tenantId')),
        eq(bookings.id, resourceId(c)),
      ),
    )
    .limit(1);
  return c.json({ data: found(row) });
});
bookingsRoutes.post('/:id/cancel', async (c) => {
  const [row] = await database(c.env.DB)
    .update(bookings)
    .set({ status: 'cancelled', updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(bookings.tenantId, c.get('tenantId')),
        eq(bookings.id, resourceId(c)),
      ),
    )
    .returning();
  return c.json({ data: found(row) });
});
