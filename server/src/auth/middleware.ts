import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../http/types';
import { bearerFrom, verifySession } from './jwt';

// Reads the Authorization bearer token and, if valid, records the user id on
// the request. Never rejects — anonymous requests proceed with no userId,
// which is correct for the methods that allow anonymous use (pocketSomm,
// reverseScan, transcribeVoice).
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const userId = verifySession(bearerFrom(c.req.header('Authorization')));
  if (userId) c.set('userId', userId);
  await next();
});
