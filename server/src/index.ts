import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config';
import type { AppEnv } from './http/types';
import { authMiddleware } from './auth/middleware';
import { authRoutes } from './auth/routes';
import { apiRoutes } from './methods/routes';
import { filesRoutes } from './storage/routes';
import { uploadRoutes } from './storage/upload';
import { migrate } from './db/migrate';
import { AuthError } from './auth/service';

const app = new Hono<AppEnv>();

app.use('*', logger());

// CORS: allow the configured frontend origins (Vite in dev, Netlify in prod).
// If no origins are configured, reflect the request origin — convenient in
// local dev, but you should always set CORS_ORIGINS in production.
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (config.corsOrigins.length === 0) return origin ?? '*';
      return config.corsOrigins.includes(origin) ? origin : '';
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Populate request context (userId) from the bearer token on every route.
app.use('*', authMiddleware);

app.get('/', (c) => c.json({ name: 'sommsavvy-server', ok: true }));
app.get('/health', (c) => c.json({ ok: true, time: Date.now() }));

app.route('/auth', authRoutes);
app.route('/api', apiRoutes);
app.route('/files', filesRoutes);
app.route('/upload', uploadRoutes);

// Uniform error envelope: { error: { code, message } }. The frontend client
// shim reads `code` (for auth branching) and `message` (for display).
app.onError((err, c) => {
  if (err instanceof AuthError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status as never);
  }
  const message = err instanceof Error ? err.message : 'Something went wrong.';
  const status = /sign in/i.test(message) ? 401 : 400;
  console.error('Request error:', err);
  return c.json({ error: { code: 'error', message } }, status as never);
});

const port = config.port;

// Ensure the database schema exists before accepting traffic. Idempotent, so
// it's safe to run on every boot/deploy (Railway included).
async function bootstrap(): Promise<void> {
  await migrate();
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`sommsavvy-server listening on port ${info.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app };
