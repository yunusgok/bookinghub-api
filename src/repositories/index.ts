import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { apiKeys } from '../db/schema';
export const database = (binding: D1Database) => drizzle(binding);
export async function credentialTenant(binding: D1Database, hash: string) {
  const db = database(binding);
  const rows = await db
    .select({ tenantId: apiKeys.tenantId, revokedAt: apiKeys.revokedAt })
    .from(apiKeys)
    .where(and(eq(apiKeys.hash, hash)))
    .limit(1);
  return rows[0]?.revokedAt === null ? rows[0].tenantId : undefined;
}
