import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';

// Storage abstraction for binary blobs (generated bottle portraits + user
// uploads). Two backends:
//   - local disk (default): writes under .uploads/, served by the backend at
//     /files/<key>. Good for dev and single-instance deploys.
//   - Cloudflare R2 (wired in the storage phase): used when R2_* env is set.
//
// `put` returns an absolute, publicly fetchable URL so the frontend (on a
// different origin) can load the asset directly.

export interface StoredObject {
  url: string;
  key: string;
}

export interface StorageBackend {
  put(bytes: Buffer, contentType: string, ext: string): Promise<StoredObject>;
}

const UPLOAD_DIR = join(process.cwd(), '.uploads');

class LocalStorage implements StorageBackend {
  async put(bytes: Buffer, _contentType: string, ext: string): Promise<StoredObject> {
    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });
    const key = `${randomUUID()}.${ext.replace(/^\./, '')}`;
    await writeFile(join(UPLOAD_DIR, key), bytes);
    return { key, url: `${config.publicBaseUrl}/files/${key}` };
  }
}

// Cloudflare R2 (S3-compatible). Objects are written to the bucket and served
// from the bucket's public URL, decoupling image hosting from the backend so
// they survive redeploys and load directly on any device.
class R2Storage implements StorageBackend {
  private client: S3Client;
  private bucket: string;
  private publicBase: string;

  constructor(cfg: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicBaseUrl: string;
  }) {
    this.bucket = cfg.bucket;
    this.publicBase = cfg.publicBaseUrl.replace(/\/$/, '');
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  async put(bytes: Buffer, contentType: string, ext: string): Promise<StoredObject> {
    const key = `${randomUUID()}.${ext.replace(/^\./, '')}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
    return { key, url: `${this.publicBase}/${key}` };
  }
}

// True when every R2 setting is present.
function r2Configured(): boolean {
  const r = config.r2;
  return Boolean(
    r.accountId && r.accessKeyId && r.secretAccessKey && r.bucket && r.publicBaseUrl,
  );
}

let backend: StorageBackend | null = null;

export function getStorage(): StorageBackend {
  if (backend) return backend;
  if (r2Configured()) {
    const r = config.r2;
    backend = new R2Storage({
      accountId: r.accountId,
      accessKeyId: r.accessKeyId,
      secretAccessKey: r.secretAccessKey,
      bucket: r.bucket,
      publicBaseUrl: r.publicBaseUrl,
    });
    console.log(`Storage: Cloudflare R2 (bucket "${r.bucket}").`);
  } else {
    backend = new LocalStorage();
    console.log('Storage: local disk (.uploads). Set R2_* env to use Cloudflare R2.');
  }
  return backend;
}

export const LOCAL_UPLOAD_DIR = UPLOAD_DIR;

// Map a few common content types to file extensions.
export function extForContentType(ct: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'video/webm': 'webm',
    'video/mp4': 'mp4',
  };
  return map[ct] ?? 'bin';
}
