import { env } from 'cloudflare:workers';
import { app } from '../src/app';
import { generateKey, hashKey } from '../src/lib/keys';
import { database } from '../src/repositories';
import { tenants, apiKeys } from '../src/db/schema';
export async function tenant() {
  const id = crypto.randomUUID(),
    key = generateKey(),
    keyId = crypto.randomUUID(),
    now = new Date().toISOString();
  const db = database(env.DB);
  await db.insert(tenants).values({ id, name: 'Test tenant', createdAt: now });
  await db.insert(apiKeys).values({
    id: keyId,
    tenantId: id,
    hash: await hashKey(key),
    createdAt: now,
  });
  return { id, key, keyId };
}
export function request(
  path: string,
  key?: string,
  method = 'GET',
  body?: unknown,
  overrideEnv = env,
) {
  return app.request(
    `https://bookinghub.test${path}`,
    {
      method,
      headers: {
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
    overrideEnv,
  );
}
export async function fixtures() {
  const t = await tenant();
  const customer = await (
    await request('/v1/customers', t.key, 'POST', {
      name: 'Demo',
      email: 'demo@example.com',
    })
  ).json<{ data: { id: string } }>();
  const service = await (
    await request('/v1/services', t.key, 'POST', {
      name: 'Consultation',
      durationMinutes: 30,
    })
  ).json<{ data: { id: string } }>();
  return { ...t, customerId: customer.data.id, serviceId: service.data.id };
}
export const start = '2027-01-15T10:00:00.000Z';
