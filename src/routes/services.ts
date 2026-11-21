import { Hono } from 'hono';
import { and, eq, asc } from 'drizzle-orm';
import type { AppEnv } from '../lib/types';
import { database } from '../repositories';
import { services } from '../db/schema';
import { serviceInput, nonEmpty, pagination } from '../schemas/input';
import { body, resourceId, found } from '../lib/http';
export const servicesRoutes = new Hono<AppEnv>();
servicesRoutes.post('/', async (c) => {
  const input = await body(c, serviceInput);
  const now = new Date().toISOString();
  const [row] = await database(c.env.DB)
    .insert(services)
    .values({
      ...input,
      id: crypto.randomUUID(),
      tenantId: c.get('tenantId'),
      createdAt: now,
    })
    .returning();
  c.header('Location', `/v1/services/${row!.id}`);
  return c.json({ data: row }, 201);
});
servicesRoutes.get('/', async (c) => {
  const { limit, offset } = pagination.parse(c.req.query());
  const rows = await database(c.env.DB)
    .select()
    .from(services)
    .where(eq(services.tenantId, c.get('tenantId')))
    .orderBy(asc(services.createdAt), asc(services.id))
    .limit(limit + 1)
    .offset(offset);
  return c.json({
    data: rows.slice(0, limit),
    pagination: { limit, offset, hasMore: rows.length > limit },
  });
});
servicesRoutes.get('/:id', async (c) => {
  const [row] = await database(c.env.DB)
    .select()
    .from(services)
    .where(
      and(
        eq(services.tenantId, c.get('tenantId')),
        eq(services.id, resourceId(c)),
      ),
    )
    .limit(1);
  return c.json({ data: found(row) });
});
servicesRoutes.patch('/:id', async (c) => {
  const input = await body(c, nonEmpty(serviceInput));
  const [row] = await database(c.env.DB)
    .update(services)
    .set(input)
    .where(
      and(
        eq(services.tenantId, c.get('tenantId')),
        eq(services.id, resourceId(c)),
      ),
    )
    .returning();
  return c.json({ data: found(row) });
});
servicesRoutes.delete('/:id', async (c) => {
  const [row] = await database(c.env.DB)
    .update(services)
    .set({ active: false })
    .where(
      and(
        eq(services.tenantId, c.get('tenantId')),
        eq(services.id, resourceId(c)),
      ),
    )
    .returning();
  found(row);
  return c.body(null, 204);
});
