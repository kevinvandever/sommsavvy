import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppEnv } from '../http/types';
import { runMethod } from '../http/runMethod';
import { getClientIp, getAnonToken } from '../usage/clientIp';
import { checkRateLimit, recordRequest } from '../usage/rateLimit';
import { resolveIdentity, checkAnonCallGate } from '../usage/guardrails';

import { saveCellarEntry } from './saveCellarEntry';
import { listCellar } from './listCellar';
import { getEntry } from './getEntry';
import { updateCellarEntry } from './updateCellarEntry';
import { removeCellarEntry } from './removeCellarEntry';
import { getMe } from './getMe';
import { updateProfile } from './updateProfile';
import { regenerateTasteSummary } from './regenerateTasteSummary';
import { pocketSomm } from './pocketSomm';
import { reverseScan } from './reverseScan';
import { smartScan } from './smartScan';
import { transcribeVoice } from './transcribeVoice';

// Each method is exposed as POST /api/<camelCaseName>, matching the names the
// frontend RPC client calls. Input is the JSON body; the result is returned
// as JSON. Every handler runs inside the request context so auth.userId
// resolves correctly.
export const apiRoutes = new Hono<AppEnv>();

/**
 * Messages that indicate the caller must sign in. When a method throws one of
 * these, the wrapper returns 401 with code `sign_in_required` so the frontend
 * can trigger the email-code auth flow (Requirements 1.5, 1.6).
 */
const SIGN_IN_MESSAGES = ['Sign in to save to your cellar.'];

function post<I extends object, O>(path: string, fn: (input: I) => Promise<O>): void {
  apiRoutes.post(path, async (c) => {
    const input = (await c.req.json<I>().catch(() => ({}))) as I;
    try {
      const result = await runMethod(c, () => fn(input));
      return c.json(result as Record<string, unknown>);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      if (SIGN_IN_MESSAGES.includes(message)) {
        return c.json({ error: { code: 'sign_in_required', message } }, 401);
      }
      return c.json({ error: { code: 'method_error', message } }, 400);
    }
  });
}

post('/saveCellarEntry', saveCellarEntry);
post('/listCellar', listCellar);
post('/getEntry', getEntry);
post('/updateCellarEntry', updateCellarEntry);
post('/removeCellarEntry', removeCellarEntry);
post('/updateProfile', updateProfile);
post('/getMe', () => getMe());
post('/regenerateTasteSummary', () => regenerateTasteSummary());

// transcribeVoice is plain request/response.
post('/transcribeVoice', transcribeVoice);

// Streaming AI methods. They emit { status } and { partialResult } events over
// SSE during execution, then a final { result } event. On failure they emit a
// single { error } event. The client shim reads these via fetch + a stream
// reader (not EventSource), so POST with a JSON body works.
//
// Guardrail checks (rate limit + anonymous call gate) run BEFORE entering the
// SSE stream. If a guardrail blocks, a plain JSON error response is returned
// without ever opening the stream.
function sseMethod<I extends object, O>(path: string, fn: (input: I) => Promise<O>): void {
  apiRoutes.post(path, async (c) => {
    // --- Guardrail checks (pre-stream) ---
    const ip = getClientIp(c);
    const anonToken = getAnonToken(c);

    // 1. Per-IP rate limit
    const rateResult = checkRateLimit(ip);
    if (!rateResult.allowed) {
      return c.json(
        {
          error: {
            code: 'rate_limited',
            message: 'Too many requests. Please wait a moment.',
            retryAfter: Math.ceil((rateResult.retryAfterMs ?? 0) / 1000),
          },
        },
        429,
      );
    }

    // 2. Anonymous call gate
    const userId = c.get('userId');
    if (!userId) {
      const identity = resolveIdentity(undefined, anonToken, ip);
      const gate = await checkAnonCallGate(identity.primary);
      if (!gate.allowed) {
        return c.json(
          {
            error: {
              code: 'sign_in_required',
              message: 'Sign in to continue.',
            },
          },
          401,
        );
      }
    }

    // 3. Record the rate-limit timestamp (only when proceeding)
    recordRequest(ip);

    // Store IP and anonToken on the Hono context so runMethod can pass them
    // into the async request context for downstream usage (image allowance).
    c.set('clientIp', ip);
    c.set('anonToken', anonToken);

    // --- Enter SSE stream ---
    return streamSSE(c, async (sse) => {
      const input = (await c.req.json<I>().catch(() => ({}))) as I;
      const emit = async (payload: unknown) => {
        await sse.writeSSE({ data: JSON.stringify(payload) });
      };
      try {
        const result = await runMethod(c, () => fn(input), emit);
        await sse.writeSSE({ data: JSON.stringify({ result }) });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        const code =
          err instanceof Error && 'code' in err && typeof (err as { code: unknown }).code === 'string'
            ? (err as { code: string }).code
            : undefined;
        await sse.writeSSE({ data: JSON.stringify({ error: { message, ...(code && { code }) } }) });
      }
    });
  });
}

sseMethod('/pocketSomm', pocketSomm);
sseMethod('/reverseScan', reverseScan);
sseMethod('/smartScan', smartScan);
