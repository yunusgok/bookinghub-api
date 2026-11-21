import { z } from 'zod';
import { customerInput, serviceInput, bookingInput } from './schemas/input';
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ 'application/json': { schema } });
const id = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};
const page = [
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
  {
    name: 'offset',
    in: 'query',
    schema: { type: 'integer', minimum: 0, maximum: 100000, default: 0 },
  },
];
const errors = Object.fromEntries(
  [400, 401, 404, 409, 413, 422, 429, 500].map((status) => [
    status,
    {
      description: {
        400: 'Malformed request',
        401: 'Missing or invalid API key',
        404: 'Resource not found',
        409: 'Business rule conflict',
        413: 'Body exceeds 16 KiB',
        422: 'Validation error',
        429: 'Rate limit exceeded',
        500: 'Internal error',
      }[status],
      content: json(ref('Error')),
    },
  ]),
);
const headers = {
  'X-Request-ID': {
    schema: { type: 'string', format: 'uuid' },
    description: 'Server-generated request correlation ID',
  },
};
const response = (schema: unknown, description = 'Success') => ({
  description,
  headers,
  content: json(schema),
});
const envelope = (name: string) => ({
  type: 'object',
  required: ['data'],
  properties: { data: ref(name) },
});
const list = (name: string) => ({
  type: 'object',
  required: ['data', 'pagination'],
  properties: {
    data: { type: 'array', items: ref(name) },
    pagination: {
      type: 'object',
      required: ['limit', 'offset', 'hasMore'],
      properties: {
        limit: { type: 'integer' },
        offset: { type: 'integer' },
        hasMore: { type: 'boolean' },
      },
    },
  },
});
const request = (schema: unknown) => ({
  required: true,
  content: json(schema),
});
const paths: Record<string, unknown> = {
  '/health': {
    get: {
      security: [],
      responses: {
        200: response({
          type: 'object',
          properties: {
            data: { type: 'object', properties: { status: { const: 'ok' } } },
          },
        }),
      },
    },
  },
  '/openapi.json': {
    get: { security: [], responses: { 200: response({ type: 'object' }) } },
  },
};
for (const [plural, name, input] of [
  ['customers', 'Customer', customerInput],
  ['services', 'Service', serviceInput],
] as const) {
  paths[`/v1/${plural}`] = {
    get: {
      tags: [plural],
      parameters: page,
      responses: { ...errors, 200: response(list(name)) },
    },
    post: {
      tags: [plural],
      requestBody: request(z.toJSONSchema(input, { io: 'input' })),
      responses: { ...errors, 201: response(envelope(name), 'Created') },
    },
  };
  paths[`/v1/${plural}/{id}`] = {
    get: {
      tags: [plural],
      parameters: [id],
      responses: { ...errors, 200: response(envelope(name)) },
    },
    patch: {
      tags: [plural],
      parameters: [id],
      requestBody: request({
        ...z.toJSONSchema(input.partial(), {
          io: 'input',
          unrepresentable: 'any',
        }),
        minProperties: 1,
      }),
      responses: { ...errors, 200: response(envelope(name)) },
    },
    delete: {
      tags: [plural],
      summary: 'Idempotently deactivate; retain history',
      parameters: [id],
      responses: { ...errors, 204: { description: 'Deactivated', headers } },
    },
  };
}
paths['/v1/bookings'] = {
  get: {
    tags: ['bookings'],
    parameters: [
      ...page,
      {
        name: 'status',
        in: 'query',
        schema: { type: 'string', enum: ['active', 'cancelled'] },
      },
      ...['customerId', 'serviceId'].map((name) => ({
        name,
        in: 'query',
        schema: { type: 'string', format: 'uuid' },
      })),
      ...['from', 'to'].map((name) => ({
        name,
        in: 'query',
        description:
          'Filter booking start time; from inclusive, to exclusive. UTC with milliseconds.',
        schema: { type: 'string', format: 'date-time' },
      })),
    ],
    responses: { ...errors, 200: response(list('Booking')) },
  },
  post: {
    tags: ['bookings'],
    requestBody: request(z.toJSONSchema(bookingInput)),
    responses: { ...errors, 201: response(envelope('Booking'), 'Created') },
  },
};
paths['/v1/bookings/{id}'] = {
  get: {
    tags: ['bookings'],
    parameters: [id],
    responses: { ...errors, 200: response(envelope('Booking')) },
  },
};
paths['/v1/bookings/{id}/cancel'] = {
  post: {
    tags: ['bookings'],
    summary: 'Idempotently cancel a booking',
    parameters: [id],
    responses: { ...errors, 200: response(envelope('Booking')) },
  },
};
const timestamp = { type: 'string', format: 'date-time' };
const common = {
  id: { type: 'string', format: 'uuid' },
  tenantId: { type: 'string', format: 'uuid' },
  createdAt: timestamp,
};
const entity = (properties: Record<string, unknown>) => ({
  type: 'object',
  required: Object.keys(properties),
  properties,
});
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'BookingHub API',
    version: '1.0.0',
    description:
      'One bookable resource per tenant. Bearer credentials determine tenant identity. Bodies limited to 16 KiB. UTC timestamps require milliseconds. DELETE deactivates customers/services. Pagination includes inactive records. Rate limits are approximate, per Cloudflare location.',
  },
  servers: [{ url: '/', description: 'Current API server' }],
  security: [{ ApiKey: [] }],
  paths,
  components: {
    securitySchemes: {
      ApiKey: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'bh_<64 hex characters>',
      },
    },
    schemas: {
      Customer: entity({
        ...common,
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        phone: { type: ['string', 'null'] },
        active: { type: 'boolean' },
        updatedAt: timestamp,
      }),
      Service: entity({
        ...common,
        name: { type: 'string' },
        description: { type: 'string' },
        durationMinutes: { type: 'integer', minimum: 1, maximum: 1440 },
        active: { type: 'boolean' },
      }),
      Booking: entity({
        ...common,
        customerId: { type: 'string', format: 'uuid' },
        serviceId: { type: 'string', format: 'uuid' },
        startAt: timestamp,
        endAt: timestamp,
        status: { type: 'string', enum: ['active', 'cancelled'] },
        updatedAt: timestamp,
      }),
      Error: entity({
        error: entity({
          code: { type: 'string' },
          message: { type: 'string' },
          requestId: { type: 'string', format: 'uuid' },
        }),
      }),
    },
  },
};
