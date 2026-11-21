import { it, expect, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { tenant, request, fixtures, start } from '../helpers';
import { app } from '../../src/app';
it('health and OpenAPI are public and have request IDs', async () => {
  const r = await request('/health');
  expect(r.status).toBe(200);
  expect(r.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]{36}$/);
  const spec = await (
    await request('/openapi.json')
  ).json<{ paths: Record<string, unknown> }>();
  expect(spec.paths['/v1/bookings']).toBeDefined();
});
it('serves public Swagger UI using the API contract and current origin', async () => {
  const response = await request('/docs');
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toContain('text/html');
  const html = await response.text();
  expect(html).toContain('SwaggerUIBundle');
  expect(html).toContain('/openapi.json');
  expect(html).toContain('swagger-ui-dist@5.35.1');
  const spec = await (
    await request('/openapi.json')
  ).json<{ servers: { url: string }[] }>();
  expect(spec.servers[0]?.url).toBe('/');
});
it('enforces authentication and revocation without leaking keys', async () => {
  const t = await tenant();
  expect((await request('/v1/customers')).status).toBe(401);
  expect((await request('/v1/customers', 'bh_' + 'a'.repeat(64))).status).toBe(
    401,
  );
  expect((await request('/v1/customers', t.key)).status).toBe(200);
  await env.DB.prepare('UPDATE api_keys SET revoked_at=? WHERE id=?')
    .bind(start, t.keyId)
    .run();
  expect((await request('/v1/customers', t.key)).status).toBe(401);
});
it('customer CRUD, pagination, uniqueness and SQL injection resistance', async () => {
  const t = await tenant();
  const payload = {
    name: "O'Brien'; DROP TABLE customers; --",
    email: 'demo@example.com',
    phone: '+353 1234567',
  };
  const created = await request('/v1/customers', t.key, 'POST', payload);
  expect(created.status).toBe(201);
  const { data } = await created.json<{ data: { id: string; name: string } }>();
  expect(data.name).toBe(payload.name);
  expect(created.headers.get('Location')).toBe(`/v1/customers/${data.id}`);
  expect((await request('/v1/customers', t.key, 'POST', payload)).status).toBe(
    409,
  );
  expect((await request(`/v1/customers/${data.id}`, t.key)).status).toBe(200);
  expect(
    (
      await request(`/v1/customers/${data.id}`, t.key, 'PATCH', {
        name: 'Updated',
      })
    ).status,
  ).toBe(200);
  await request('/v1/customers', t.key, 'POST', {
    name: 'Second',
    email: 'second@example.com',
  });
  const page = await (
    await request('/v1/customers?limit=1', t.key)
  ).json<{ data: unknown[]; pagination: { hasMore: boolean } }>();
  expect(page.data).toHaveLength(1);
  expect(page.pagination.hasMore).toBe(true);
  const next = await (
    await request('/v1/customers?limit=1&offset=1', t.key)
  ).json<{ data: unknown[]; pagination: { hasMore: boolean } }>();
  expect(next.data).toHaveLength(1);
  expect(next.pagination.hasMore).toBe(false);
  expect(
    (await request(`/v1/customers/${data.id}`, t.key, 'DELETE')).status,
  ).toBe(204);
  expect(
    (
      await (
        await request(`/v1/customers/${data.id}`, t.key)
      ).json<{ data: { active: boolean } }>()
    ).data.active,
  ).toBe(false);
});
it('service CRUD and explicit updates preserve omitted defaults', async () => {
  const f = await fixtures();
  expect(
    (
      await request(`/v1/services/${f.serviceId}`, f.key, 'PATCH', {
        description: 'Updated',
        durationMinutes: 45,
      })
    ).status,
  ).toBe(200);
  expect((await request('/v1/services', f.key)).status).toBe(200);
  expect(
    (await request(`/v1/services/${f.serviceId}`, f.key, 'DELETE')).status,
  ).toBe(204);
  expect(
    (
      await request(`/v1/services/${f.serviceId}`, f.key, 'PATCH', {
        name: 'New name',
      })
    ).status,
  ).toBe(200);
  const row = await (
    await request(`/v1/services/${f.serviceId}`, f.key)
  ).json<{ data: { active: boolean; durationMinutes: number } }>();
  expect(row.data.active).toBe(false);
  expect(row.data.durationMinutes).toBe(45);
  expect(
    (
      await request('/v1/bookings', f.key, 'POST', {
        customerId: f.customerId,
        serviceId: f.serviceId,
        startAt: start,
      })
    ).status,
  ).toBe(409);
});
it('prevents cross-tenant reads, changes, enumeration and foreign references', async () => {
  const a = await fixtures(),
    b = await fixtures();
  const booking = await (
    await request('/v1/bookings', a.key, 'POST', {
      customerId: a.customerId,
      serviceId: a.serviceId,
      startAt: start,
    })
  ).json<{ data: { id: string } }>();
  for (const [kind, id] of [
    ['customers', a.customerId],
    ['services', a.serviceId],
    ['bookings', booking.data.id],
  ]) {
    expect((await request(`/v1/${kind}/${id}`, b.key)).status).toBe(404);
    const list = await (
      await request(`/v1/${kind}`, b.key)
    ).json<{ data: { id: string }[] }>();
    expect(list.data.some((v) => v.id === id)).toBe(false);
    if (kind !== 'bookings') {
      expect(
        (await request(`/v1/${kind}/${id}`, b.key, 'PATCH', { name: 'Hijack' }))
          .status,
      ).toBe(404);
      expect((await request(`/v1/${kind}/${id}`, b.key, 'DELETE')).status).toBe(
        404,
      );
    }
  }
  expect(
    (await request(`/v1/bookings/${booking.data.id}/cancel`, b.key, 'POST'))
      .status,
  ).toBe(404);
  for (const [customerId, serviceId] of [
    [a.customerId, b.serviceId],
    [b.customerId, a.serviceId],
  ])
    expect(
      (
        await request('/v1/bookings', b.key, 'POST', {
          customerId,
          serviceId,
          startAt: start,
        })
      ).status,
    ).toBe(404);
  expect(
    (
      await request('/v1/customers', b.key, 'POST', {
        name: 'No',
        email: 'no@example.com',
        tenantId: a.id,
      })
    ).status,
  ).toBe(422);
  await expect(
    env.DB.prepare(
      'INSERT INTO bookings (id,tenant_id,customer_id,service_id,start_at,end_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
    )
      .bind(
        crypto.randomUUID(),
        b.id,
        a.customerId,
        b.serviceId,
        start,
        '2027-01-15T10:30:00.000Z',
        start,
        start,
      )
      .run(),
  ).rejects.toThrow();
});
it('booking end time, adjacency, filters, cancellation and inactive customers', async () => {
  const f = await fixtures();
  const payload = {
    customerId: f.customerId,
    serviceId: f.serviceId,
    startAt: start,
  };
  const created = await request('/v1/bookings', f.key, 'POST', payload);
  expect(created.status).toBe(201);
  const booking = await created.json<{ data: { id: string; endAt: string } }>();
  expect(booking.data.endAt).toBe('2027-01-15T10:30:00.000Z');
  expect((await request('/v1/bookings', f.key, 'POST', payload)).status).toBe(
    409,
  );
  expect(
    (
      await request('/v1/bookings', f.key, 'POST', {
        ...payload,
        startAt: booking.data.endAt,
      })
    ).status,
  ).toBe(201);
  expect(
    (await request(`/v1/bookings/${booking.data.id}/cancel`, f.key, 'POST'))
      .status,
  ).toBe(200);
  expect(
    (await request(`/v1/bookings/${booking.data.id}/cancel`, f.key, 'POST'))
      .status,
  ).toBe(200);
  expect((await request('/v1/bookings', f.key, 'POST', payload)).status).toBe(
    201,
  );
  const list = await (
    await request(
      `/v1/bookings?status=cancelled&customerId=${f.customerId}&serviceId=${f.serviceId}&from=${start}&to=2027-01-16T00:00:00.000Z&limit=1`,
      f.key,
    )
  ).json<{ data: unknown[] }>();
  expect(list.data).toHaveLength(1);
  await request(`/v1/customers/${f.customerId}`, f.key, 'DELETE');
  expect(
    (
      await request('/v1/bookings', f.key, 'POST', {
        ...payload,
        startAt: '2027-01-16T10:00:00.000Z',
      })
    ).status,
  ).toBe(409);
});
it('safe malformed/validation/not-found errors, streamed size limit, rate limiting and internal errors', async () => {
  const t = await tenant();
  expect((await request('/v1/customers?limit=0', t.key)).status).toBe(422);
  expect(
    (
      await request('/v1/services', t.key, 'POST', {
        name: 'Bad',
        durationMinutes: 0,
      })
    ).status,
  ).toBe(422);
  expect(
    (await request('/v1/services/' + crypto.randomUUID(), t.key, 'PATCH', {}))
      .status,
  ).toBe(422);
  expect((await request('/v1/customers/not-an-id', t.key)).status).toBe(422);
  expect(
    (await request('/v1/customers/' + crypto.randomUUID(), t.key)).status,
  ).toBe(404);
  const malformed = await app.request(
    '/v1/customers',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t.key}`,
        'Content-Type': 'application/json',
      },
      body: '{',
    },
    env,
  );
  expect(malformed.status).toBe(400);
  const tooLarge = await request('/v1/customers', t.key, 'POST', {
    name: 'x'.repeat(17000),
  });
  expect(tooLarge.status).toBe(413);
  const limited = await request('/v1/customers', t.key, 'GET', undefined, {
    ...env,
    RATE_LIMITER: { limit: async () => ({ success: false }) },
  });
  expect(limited.status).toBe(429);
  expect(limited.headers.get('Retry-After')).toBe('60');
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const broken = await request('/v1/customers', t.key, 'GET', undefined, {
    ...env,
    RATE_LIMITER: {
      limit: async () => {
        throw new Error('sensitive secret');
      },
    },
  });
  expect(broken.status).toBe(500);
  expect(await broken.text()).not.toContain('sensitive');
  expect(JSON.stringify(spy.mock.calls)).not.toContain(t.key);
  spy.mockRestore();
});
