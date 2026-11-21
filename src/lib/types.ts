export type Bindings = { DB: D1Database; RATE_LIMITER: RateLimit };
export type AppEnv = {
  Bindings: Bindings;
  Variables: { tenantId: string; requestId: string };
};
