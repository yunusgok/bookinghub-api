import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../lib/types';
import { ApiError } from '../lib/errors';
import { hashKey } from '../lib/keys';
import { credentialTenant } from '../repositories';
export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header || !/^Bearer bh_[a-f0-9]{64}$/.test(header))
    throw new ApiError(
      401,
      'unauthorized',
      'A valid Bearer API key is required.',
    );
  const hash = await hashKey(header.slice(7));
  const tenantId = await credentialTenant(c.env.DB, hash);
  if (!tenantId)
    throw new ApiError(
      401,
      'unauthorized',
      'A valid Bearer API key is required.',
    );
  c.set('tenantId', tenantId);
  const result = await c.env.RATE_LIMITER.limit({ key: `tenant:${tenantId}` });
  if (!result.success) {
    c.header('Retry-After', '60');
    throw new ApiError(429, 'rate_limited', 'Too many requests.');
  }
  await next();
});
