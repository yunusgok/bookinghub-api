import type { Context } from 'hono';
import { z } from 'zod';
import { ApiError } from './errors';
import type { AppEnv } from './types';
export async function body<T extends z.ZodType>(
  c: Context<AppEnv>,
  schema: T,
): Promise<z.output<T>> {
  if (!/^application\/json(?:\s*;|$)/i.test(c.req.header('Content-Type') ?? ''))
    throw new ApiError(400, 'invalid_content_type', 'Use application/json.');
  let value: unknown;
  try {
    value = await c.req.json();
  } catch {
    throw new ApiError(
      400,
      'malformed_json',
      'Request body must be valid JSON.',
    );
  }
  return schema.parse(value);
}
export function resourceId(c: Context<AppEnv>): string {
  return z.uuid().parse(c.req.param('id'));
}
export function found<T>(value: T | undefined): T {
  if (!value) throw new ApiError(404, 'not_found', 'Resource not found.');
  return value;
}
