import { Hono } from 'hono';
import type { AppEnv } from '../http/types';
import { sendEmailCode, verifyEmailCode } from './service';

// Email-code auth endpoints. Mirrors the platform's auth surface:
//   POST /auth/send-code { email }            -> { verificationId }
//   POST /auth/verify    { verificationId, code } -> { token, user }
// The frontend stores the token and sends it as a bearer on every request.
export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/send-code', async (c) => {
  const body = await c.req
    .json<{ email?: string }>()
    .catch(() => ({}) as { email?: string });
  const result = await sendEmailCode(body.email ?? '');
  return c.json(result);
});

authRoutes.post('/verify', async (c) => {
  const body = await c.req
    .json<{ verificationId?: string; code?: string }>()
    .catch(() => ({}) as { verificationId?: string; code?: string });
  const result = await verifyEmailCode(body.verificationId ?? '', body.code ?? '');
  return c.json(result);
});
