/** Disposable local smoke test. Captures one-time credentials in memory, never prints them. */
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
const run = (args: string[]) => {
  const r = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/admin.ts', ...args],
    { encoding: 'utf8' },
  );
  if (r.status !== 0)
    throw new Error(
      `Admin ${args[0]} failed; captured output withheld to protect credentials.`,
    );
  return r.stdout;
};
const credentials = (output: string) => ({
  tenantId: /Tenant ID: ([a-f0-9-]+)/.exec(output)![1]!,
  keyId: /Key ID: ([a-f0-9-]+)/.exec(output)![1]!,
  key: /API key \(shown once\): (bh_[a-f0-9]{64})/.exec(output)![1]!,
});
const initial = credentials(run(['bootstrap', 'Smoke Demo Studio']));
const replacement = credentials(run(['issue-key', initial.tenantId]));
run(['seed', initial.tenantId]);
const worker = spawn(
  process.execPath,
  ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--port', '8788'],
  { stdio: 'ignore', detached: process.platform !== 'win32' },
);
const base = 'http://127.0.0.1:8788';
async function call(
  path: string,
  key = initial.key,
  method = 'GET',
  body?: unknown,
) {
  return fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch(base + '/health')).ok;
    } catch {
      /* runtime starting */
    }
    if (ready) break;
    await setTimeout(300);
  }
  assert(ready, 'Local Worker failed to start');
  const customers = (await (await call('/v1/customers')).json()) as {
    data: { id: string }[];
  };
  const services = (await (await call('/v1/services')).json()) as {
    data: { id: string }[];
  };
  assert.equal(customers.data.length, 1);
  assert.equal(services.data.length, 1);
  const payload = {
    customerId: customers.data[0]!.id,
    serviceId: services.data[0]!.id,
    startAt: '2027-01-15T10:00:00.000Z',
  };
  const booking = await call('/v1/bookings', initial.key, 'POST', payload);
  assert.equal(booking.status, 201);
  const { data } = (await booking.json()) as { data: { id: string } };
  assert.equal(
    (await call('/v1/bookings', initial.key, 'POST', payload)).status,
    409,
  );
  assert.equal(
    (await call(`/v1/bookings/${data.id}/cancel`, initial.key, 'POST')).status,
    200,
  );
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () =>
      call('/v1/bookings', initial.key, 'POST', payload),
    ),
  );
  assert.equal(concurrent.filter((r) => r.status === 201).length, 1);
  assert.equal(concurrent.filter((r) => r.status === 409).length, 7);
  run(['revoke-key', initial.keyId]);
  assert.equal((await call('/v1/customers')).status, 401);
  assert.equal((await call('/v1/customers', replacement.key)).status, 200);
  console.log(
    'PASS: bootstrap, seed, live HTTP, booking conflict/cancel/concurrency, credential rotation and revocation.',
  );
} finally {
  run(['revoke-key', initial.keyId]);
  run(['revoke-key', replacement.keyId]);
  if (worker.pid) {
    if (process.platform === 'win32') worker.kill();
    else process.kill(-worker.pid, 'SIGTERM');
  }
}
