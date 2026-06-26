import { Hono } from 'hono';
import { getStorage, extForContentType } from './index';

// Accepts a multipart file upload (user photos, recorded audio) and returns
// its public URL. Replaces the platform's file-upload service. Open to
// anonymous callers, since Pocket Somm / Reverse Scan work without sign-in.
export const uploadRoutes = new Hono();

uploadRoutes.post('/', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) {
    return c.json({ error: { code: 'no_file', message: 'No file provided.' } }, 400);
  }

  const contentType = file.type || 'application/octet-stream';
  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await getStorage().put(bytes, contentType, extForContentType(contentType));
  return c.json({ url: stored.url });
});
