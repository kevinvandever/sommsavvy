import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppEnv } from '../http/types';
import { runMethod } from '../http/runMethod';

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
import { transcribeVoice } from './transcribeVoice';

// Each method is exposed as POST /api/<camelCaseName>, matching the names the
// frontend RPC client calls. Input is the JSON body; the result is returned
// as JSON. Every handler runs inside the request context so auth.userId
// resolves correctly.
export const apiRoutes = new Hono<AppEnv>();

function post<I extends object, O>(path: string, fn: (input: I) => Promise<O>): void {
  apiRoutes.post(path, async (c) => {
    const input = (await c.req.json<I>().catch(() => ({}))) as I;
    const result = await runMethod(c, () => fn(input));
    return c.json(result as Record<string, unknown>);
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
function sseMethod<I extends object, O>(path: string, fn: (input: I) => Promise<O>): void {
  apiRoutes.post(path, (c) =>
    streamSSE(c, async (sse) => {
      const input = (await c.req.json<I>().catch(() => ({}))) as I;
      const emit = async (payload: unknown) => {
        await sse.writeSSE({ data: JSON.stringify(payload) });
      };
      try {
        const result = await runMethod(c, () => fn(input), emit);
        await sse.writeSSE({ data: JSON.stringify({ result }) });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        await sse.writeSSE({ data: JSON.stringify({ error: { message } }) });
      }
    }),
  );
}

sseMethod('/pocketSomm', pocketSomm);
sseMethod('/reverseScan', reverseScan);
