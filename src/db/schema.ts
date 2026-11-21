import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  unique,
  foreignKey,
  index,
  check,
} from 'drizzle-orm/sqlite-core';
export const tenants = sqliteTable('tenants', {
  id: text().primaryKey(),
  name: text().notNull(),
  createdAt: text('created_at').notNull(),
});
export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    hash: text().notNull().unique(),
    createdAt: text('created_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (t) => [index('api_keys_tenant_idx').on(t.tenantId)],
);
export const customers = sqliteTable(
  'customers',
  {
    id: text().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text().notNull(),
    email: text().notNull(),
    phone: text(),
    active: integer({ mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    unique('customers_tenant_id').on(t.tenantId, t.id),
    unique('customers_tenant_email').on(t.tenantId, t.email),
    index('customers_page_idx').on(t.tenantId, t.createdAt, t.id),
    check('customers_active', sql`${t.active} IN (0,1)`),
  ],
);
export const services = sqliteTable(
  'services',
  {
    id: text().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text().notNull(),
    description: text().notNull().default(''),
    durationMinutes: integer('duration_minutes').notNull(),
    active: integer({ mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    unique('services_tenant_id').on(t.tenantId, t.id),
    index('services_page_idx').on(t.tenantId, t.createdAt, t.id),
    check('services_duration', sql`${t.durationMinutes} BETWEEN 1 AND 1440`),
    check('services_active', sql`${t.active} IN (0,1)`),
  ],
);
export const bookings = sqliteTable(
  'bookings',
  {
    id: text().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    customerId: text('customer_id').notNull(),
    serviceId: text('service_id').notNull(),
    startAt: text('start_at').notNull(),
    endAt: text('end_at').notNull(),
    status: text({ enum: ['active', 'cancelled'] })
      .notNull()
      .default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.serviceId],
      foreignColumns: [services.tenantId, services.id],
    }),
    index('bookings_overlap_idx').on(t.tenantId, t.status, t.startAt, t.endAt),
    index('bookings_page_idx').on(t.tenantId, t.createdAt, t.id),
    check('bookings_status', sql`${t.status} IN ('active','cancelled')`),
    check('bookings_interval', sql`${t.startAt} < ${t.endAt}`),
  ],
);
