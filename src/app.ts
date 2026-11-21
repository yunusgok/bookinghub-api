import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { ZodError } from 'zod';
import type { AppEnv } from './lib/types';
import { ApiError, databaseError } from './lib/errors';
import { authenticate } from './middleware/auth';
import { customersRoutes } from './routes/customers';
import { servicesRoutes } from './routes/services';
import { bookingsRoutes } from './routes/bookings';
import { openapi } from './openapi';
export const app = new Hono<AppEnv>();
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  c.header('X-Request-ID', c.get('requestId'));
  c.header('Cache-Control', 'no-store');
  const start = Date.now();
  await next();
  // Deliberately omit paths, bodies, credentials, query strings and exception messages.
  console.log(
    JSON.stringify({
      requestId: c.get('requestId'),
      method: c.req.method,
      status: c.res.status,
      elapsedMs: Date.now() - start,
    }),
  );
});
app.use('*', secureHeaders());
app.use(
  '*',
  bodyLimit({
    maxSize: 16_384,
    onError: () => {
      throw new ApiError(413, 'body_too_large', 'Request body exceeds 16 KiB.');
    },
  }),
);
app.get('/health', (c) => c.json({ data: { status: 'ok' } }));
app.get('/openapi.json', (c) => c.json(openapi));
app.get(
  '/docs',
  swaggerUI({
    title: 'BookingHub API — Swagger UI',
    url: '/openapi.json',
    version: '5.35.1',
    deepLinking: true,
    filter: true,
    persistAuthorization: false,
    validatorUrl: '',
  }),
);
app.use('/v1/*', async (c, next) => {
  const result = await c.env.RATE_LIMITER.limit({
    key: `ip:${c.req.header('CF-Connecting-IP') ?? 'local'}`,
  });
  if (!result.success) {
    c.header('Retry-After', '60');
    throw new ApiError(429, 'rate_limited', 'Too many requests.');
  }
  await next();
});
app.use('/v1/*', authenticate);
app.route('/v1/customers', customersRoutes);
app.route('/v1/services', servicesRoutes);
app.route('/v1/bookings', bookingsRoutes);
app.notFound(() => {
  throw new ApiError(404, 'not_found', 'Resource not found.');
});
app.onError((error, c) => {
  let safe: unknown = error;
  try {
    databaseError(error);
  } catch (mapped) {
    safe = mapped;
  }
  const validation = safe instanceof ZodError;
  const status =
    safe instanceof ApiError ? safe.status : validation ? 422 : 500;
  return c.json(
    {
      error: {
        code:
          safe instanceof ApiError
            ? safe.code
            : validation
              ? 'validation_error'
              : 'internal_error',
        message:
          safe instanceof ApiError
            ? safe.message
            : validation
              ? 'Input validation failed.'
              : 'An unexpected error occurred.',
        requestId: c.get('requestId'),
      },
    },
    status,
  );
});
