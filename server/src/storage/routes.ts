import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { LOCAL_UPLOAD_DIR } from './index';

// Serves locally-stored files (dev / local backend). When R2 is configured,
// assets are served from R2's public URL instead and these routes go unused.
export const filesRoutes = new Hono();

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
  '.mp4': 'video/mp4',
};

filesRoutes.get('/:key', async (c) => {
  // basename guards against path traversal in the key.
  const key = basename(c.req.param('key'));
  try {
    const bytes = await readFile(join(LOCAL_UPLOAD_DIR, key));
    const type = CONTENT_TYPES[extname(key).toLowerCase()] ?? 'application/octet-stream';
    c.header('Content-Type', type);
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    return c.body(bytes as unknown as ArrayBuffer);
  } catch {
    return c.json({ error: { code: 'not_found', message: 'File not found.' } }, 404);
  }
});
