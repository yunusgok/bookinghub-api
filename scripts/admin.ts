/** Operator-only CLI. No HTTP administrative surface; local unless --remote is explicit. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKey, hashKey } from '../src/lib/keys';
const args = process.argv.slice(2);
const remote = args.includes('--remote');
const [command, argument] = args.filter((v) => v !== '--remote');
const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const uuid = (value: string | undefined): string => {
  if (!value || !/^[a-f0-9-]{36}$/.test(value))
    throw new Error('A UUID is required');
  return value;
};
let sql = '';
let key: string | undefined;
let tenantId: string | undefined;
const now = new Date().toISOString();
const keyId = crypto.randomUUID();
if (command === 'bootstrap') {
  if (!argument || argument.length > 120)
    throw new Error('Usage: npm run admin -- bootstrap "Business name"');
  tenantId = crypto.randomUUID();
  sql += `INSERT INTO tenants(id,name,created_at) VALUES(${quote(tenantId)},${quote(argument)},${quote(now)});\n`;
} else if (command === 'issue-key' || command === 'seed') {
  tenantId = uuid(argument);
} else if (command === 'revoke-key') {
  sql = `UPDATE api_keys SET revoked_at=${quote(now)} WHERE id=${quote(uuid(argument))};`;
} else {
  throw new Error(
    'Commands: bootstrap <name>, issue-key <tenant-uuid>, revoke-key <key-uuid>, seed <tenant-uuid>; optional --remote',
  );
}
if (command === 'bootstrap' || command === 'issue-key') {
  key = generateKey();
  sql += `INSERT INTO api_keys(id,tenant_id,hash,created_at) VALUES(${quote(keyId)},${quote(tenantId!)},${quote(await hashKey(key))},${quote(now)});`;
}
if (command === 'seed') {
  if (remote) throw new Error('Demo seeding is local-only');
  const customerId = crypto.randomUUID(),
    serviceId = crypto.randomUUID();
  sql = `INSERT INTO customers(id,tenant_id,name,email,created_at,updated_at) VALUES(${quote(customerId)},${quote(tenantId!)},'Demo Customer',${quote(`demo-${customerId}@example.com`)},${quote(now)},${quote(now)});
 INSERT INTO services(id,tenant_id,name,description,duration_minutes,created_at) VALUES(${quote(serviceId)},${quote(tenantId!)},'Demo Consultation','Synthetic demo data',30,${quote(now)});`;
}
const directory = mkdtempSync(join(tmpdir(), 'bookinghub-admin-'));
try {
  const file = join(directory, 'admin.sql');
  // Only hashes enter the SQL file. Keep even those restricted and remove on exit.
  writeFileSync(file, sql, { mode: 0o600 });
  const result = spawnSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'bookinghub',
      remote ? '--remote' : '--local',
      '--file',
      file,
      '--yes',
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error('Database operation failed');
  if (key)
    process.stdout.write(
      `\nTenant ID: ${tenantId}\nKey ID: ${keyId}\nAPI key (shown once): ${key}\n`,
    );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
