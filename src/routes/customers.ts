import { Hono } from 'hono';
import { and, eq, asc } from 'drizzle-orm';
import type { AppEnv } from '../lib/types';
import { database } from '../repositories';
import { customers } from '../db/schema';
import { customerInput, nonEmpty, pagination } from '../schemas/input';
import { body, resourceId, found } from '../lib/http';
export const customersRoutes = new Hono<AppEnv>();
customersRoutes.post('/', async (c) => {
  const input = await body(c, customerInput);
  const now = new Date().toISOString();
  const [row] = await database(c.env.DB)
    .insert(customers)
    .values({
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      updatedAt: now,
      id: crypto.randomUUID(),
      tenantId: c.get('tenantId'),
      createdAt: now,
    })
    .returning();
  c.header('Location', `/v1/customers/${row!.id}`);
  return c.json({ data: row }, 201);
});
customersRoutes.get('/', async (c) => {
  const { limit, offset } = pagination.parse(c.req.query());
  const rows = await database(c.env.DB)
    .select()
    .from(customers)
    .where(eq(customers.tenantId, c.get('tenantId')))
    .orderBy(asc(customers.createdAt), asc(customers.id))
    .limit(limit + 1)
    .offset(offset);
  return c.json({
    data: rows.slice(0, limit),
    pagination: { limit, offset, hasMore: rows.length > limit },
  });
});
customersRoutes.get('/:id', async (c) => {
  const [row] = await database(c.env.DB)
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, c.get('tenantId')),
        eq(customers.id, resourceId(c)),
      ),
    )
    .limit(1);
  return c.json({ data: found(row) });
});
customersRoutes.patch('/:id', async (c) => {
  const input = await body(c, nonEmpty(customerInput));
  const [row] = await database(c.env.DB)
    .update(customers)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(customers.tenantId, c.get('tenantId')),
        eq(customers.id, resourceId(c)),
      ),
    )
    .returning();
  return c.json({ data: found(row) });
});
customersRoutes.delete('/:id', async (c) => {
  const [row] = await database(c.env.DB)
    .update(customers)
    .set({ active: false, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(customers.tenantId, c.get('tenantId')),
        eq(customers.id, resourceId(c)),
      ),
    )
    .returning();
  found(row);
  return c.body(null, 204);
});
