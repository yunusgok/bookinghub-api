import { it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { fixtures, request, start } from '../helpers';
it('serializes 12 overlapping API creates: exactly one succeeds and one persists', async () => {
  const f = await fixtures();
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      request('/v1/bookings', f.key, 'POST', {
        customerId: f.customerId,
        serviceId: f.serviceId,
        startAt: `2027-01-15T10:${String(i).padStart(2, '0')}:00.000Z`,
      }),
    ),
  );
  expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  expect(results.filter((r) => r.status === 409)).toHaveLength(11);
  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM bookings WHERE tenant_id=? AND status=?',
  )
    .bind(f.id, 'active')
    .first<{ n: number }>();
  expect(count?.n).toBe(1);
});
it('database trigger protects concurrent direct writes and UPDATE reactivation', async () => {
  const f = await fixtures();
  const insert = (id: string) =>
    env.DB.prepare(
      'INSERT INTO bookings(id,tenant_id,customer_id,service_id,start_at,end_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
    )
      .bind(
        id,
        f.id,
        f.customerId,
        f.serviceId,
        start,
        '2027-01-15T10:30:00.000Z',
        start,
        start,
      )
      .run();
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => insert(crypto.randomUUID())),
  );
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(7);
  const old = await env.DB.prepare('SELECT id FROM bookings WHERE tenant_id=?')
    .bind(f.id)
    .first<{ id: string }>();
  await env.DB.prepare("UPDATE bookings SET status='cancelled' WHERE id=?")
    .bind(old!.id)
    .run();
  await insert(crypto.randomUUID());
  await expect(
    env.DB.prepare("UPDATE bookings SET status='active' WHERE id=?")
      .bind(old!.id)
      .run(),
  ).rejects.toThrow('booking_overlap');
  const rows = await env.DB.prepare(
    'SELECT status FROM bookings WHERE tenant_id=? ORDER BY status',
  )
    .bind(f.id)
    .all();
  expect(rows.results).toEqual([{ status: 'active' }, { status: 'cancelled' }]);
});
it('independent tenants can book the same slot', async () => {
  const a = await fixtures(),
    b = await fixtures();
  const results = await Promise.all(
    [a, b].map((f) =>
      request('/v1/bookings', f.key, 'POST', {
        customerId: f.customerId,
        serviceId: f.serviceId,
        startAt: start,
      }),
    ),
  );
  expect(results.map((r) => r.status)).toEqual([201, 201]);
});
it('D1 batch rolls back earlier writes when the overlap guard aborts', async () => {
  const f = await fixtures();
  const payload = {
    customerId: f.customerId,
    serviceId: f.serviceId,
    startAt: start,
  };
  expect((await request('/v1/bookings', f.key, 'POST', payload)).status).toBe(
    201,
  );
  const cancelledId = crypto.randomUUID();
  const insert = (id: string, status: string) =>
    env.DB.prepare(
      'INSERT INTO bookings(id,tenant_id,customer_id,service_id,start_at,end_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
    ).bind(
      id,
      f.id,
      f.customerId,
      f.serviceId,
      start,
      '2027-01-15T10:30:00.000Z',
      status,
      start,
      start,
    );
  await expect(
    env.DB.batch([
      insert(cancelledId, 'cancelled'),
      insert(crypto.randomUUID(), 'active'),
    ]),
  ).rejects.toThrow('booking_overlap');
  expect(
    await env.DB.prepare('SELECT id FROM bookings WHERE id=?')
      .bind(cancelledId)
      .first(),
  ).toBeNull();
});
it('database rejects bookings for parents deactivated after a caller read them', async () => {
  const f = await fixtures();
  await env.DB.prepare(
    'UPDATE services SET active=0 WHERE tenant_id=? AND id=?',
  )
    .bind(f.id, f.serviceId)
    .run();
  await expect(
    env.DB.prepare(
      'INSERT INTO bookings(id,tenant_id,customer_id,service_id,start_at,end_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
    )
      .bind(
        crypto.randomUUID(),
        f.id,
        f.customerId,
        f.serviceId,
        start,
        '2027-01-15T10:30:00.000Z',
        start,
        start,
      )
      .run(),
  ).rejects.toThrow('inactive_reference');
});
