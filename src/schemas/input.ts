import { z } from 'zod';
export const customerInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    phone: z.string().trim().min(3).max(32).nullable().optional(),
  })
  .strict();
export const serviceInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).optional(),
    durationMinutes: z.number().int().min(1).max(1440),
    active: z.boolean().optional(),
  })
  .strict();
export const nonEmpty = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'At least one field is required');
export const utcTimestamp = z.iso.datetime({ precision: 3 }).refine((v) => {
  const parsed = new Date(v);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === v;
}, 'Use a real UTC timestamp with milliseconds, e.g. 2027-01-01T10:00:00.000Z');
export const bookingInput = z
  .object({ customerId: z.uuid(), serviceId: z.uuid(), startAt: utcTimestamp })
  .strict();
export const pagination = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strict();
export const bookingQuery = pagination
  .extend({
    status: z.enum(['active', 'cancelled']).optional(),
    customerId: z.uuid().optional(),
    serviceId: z.uuid().optional(),
    from: utcTimestamp.optional(),
    to: utcTimestamp.optional(),
  })
  .refine((v) => !v.from || !v.to || v.from < v.to, 'from must precede to');
