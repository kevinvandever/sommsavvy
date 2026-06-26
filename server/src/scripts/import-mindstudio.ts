import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import { pool, query } from '../db/pool';
import { migrate } from '../db/migrate';
import { getStorage } from '../storage';

// Imports a MindStudio cellar export into the new database. Preserves original
// ids, timestamps, and userId so the user<->cellar relationship and savedAt
// ordering survive intact. Idempotent: re-running replaces the imported user
// and their entries.
//
// Usage:
//   npm run import -- /absolute/path/to/export-folder
//
// The folder must contain: users.json, cellar-entries.json,
// image-manifest.json, and images/.
//
// Images: copies each file into local storage (.uploads/) and rewrites
// photoUrl to a local /files URL, so the cellar renders without depending on
// the old MindStudio CDN. Re-run after configuring R2 to rehost in the cloud.

// ---- field normalizers ----

// abv arrives as "13%", "41.2%", 46.3, 12, or null. Coerce to a number.
function normalizeAbv(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace('%', '').trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

// pairings arrives as a JSON-encoded string: "[\"Coq au vin\",...]".
function normalizePairings(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* not JSON — ignore */
    }
  }
  return undefined;
}

// tasted/owned arrive as 1/0 integers (SQLite booleans).
function normalizeBool(v: unknown, fallback: boolean): boolean {
  if (v == null) return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
  return fallback;
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

// Strip keys whose value is undefined so we never persist them.
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

interface RawUser {
  id: string;
  created_at: number;
  updated_at: number;
  email: string;
  displayName?: string | null;
  depthPreference?: string | null;
  tasteSummary?: string | null;
  tasteSummaryUpdatedAt?: number | null;
  tasteSeed?: string | null;
}

interface RawEntry {
  id: string;
  created_at: number;
  updated_at: number;
  userId: string;
  [k: string]: unknown;
}

interface ImageManifest {
  [entryId: string]: { photoUrl: string; localFile: string; bytes: number };
}

async function run(): Promise<void> {
  const argDir = process.argv[2];
  if (!argDir) {
    throw new Error('Pass the export folder path: npm run import -- /path/to/folder');
  }
  const dir = isAbsolute(argDir) ? argDir : resolve(process.cwd(), argDir);

  const users = JSON.parse(await readFile(join(dir, 'users.json'), 'utf8')) as RawUser[];
  const cellarDoc = JSON.parse(await readFile(join(dir, 'cellar-entries.json'), 'utf8')) as {
    entries: RawEntry[];
  };
  const manifest: ImageManifest = existsSync(join(dir, 'image-manifest.json'))
    ? JSON.parse(await readFile(join(dir, 'image-manifest.json'), 'utf8'))
    : {};

  await migrate();

  // ---- users ----
  for (const u of users) {
    const data = compact({
      email: u.email.trim().toLowerCase(),
      displayName: str(u.displayName),
      // null depthPreference becomes undefined so the app default applies.
      depthPreference: str(u.depthPreference),
      tasteSummary: str(u.tasteSummary),
      tasteSummaryUpdatedAt: num(u.tasteSummaryUpdatedAt),
      tasteSeed: str(u.tasteSeed),
    });
    // Remove any pre-existing account with this email (e.g. one created by a
    // local sign-in) so the imported account with its original id wins.
    await query(`DELETE FROM users WHERE data->>'email' = $1 AND id <> $2`, [data.email, u.id]);
    await query(
      `INSERT INTO users (id, created_at, updated_at, data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at, data = EXCLUDED.data`,
      [u.id, u.created_at, u.updated_at, JSON.stringify(data)],
    );
    // Clear this user's existing entries so the import is a clean replace.
    await query(`DELETE FROM cellar_entries WHERE data->>'userId' = $1`, [u.id]);
    console.log(`Imported user ${data.email} (${u.id}).`);
  }

  // ---- cellar entries + images ----
  let imageCount = 0;
  for (const e of cellarDoc.entries) {
    let photoUrl = str(e.photoUrl);

    // Upload the bundled image through the storage layer (R2 when configured,
    // else local disk) and point photoUrl at the returned URL.
    const img = manifest[e.id];
    if (img?.localFile) {
      const srcPath = join(dir, img.localFile);
      if (existsSync(srcPath)) {
        const ext = (img.localFile.split('.').pop() || 'png').toLowerCase();
        const contentType =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'webp'
              ? 'image/webp'
              : 'image/png';
        const bytes = await readFile(srcPath);
        const stored = await getStorage().put(bytes, contentType, ext);
        photoUrl = stored.url;
        imageCount++;
      }
    }

    const data = compact({
      userId: e.userId,
      kind: e.kind,
      name: e.name,
      producer: str(e.producer),
      region: str(e.region),
      vintage: num(e.vintage),
      abv: normalizeAbv(e.abv),
      photoUrl,
      source: str(e.source) ?? 'scan',
      notes: str(e.notes),
      whyText: str(e.whyText),
      monocleAside: str(e.monocleAside),
      pairings: normalizePairings(e.pairings),
      occasion: str(e.occasion),
      valueNote: str(e.valueNote),
      tastedAt: num(e.tastedAt),
      savedAt: num(e.savedAt) ?? e.created_at,
      tasted: normalizeBool(e.tasted, true),
      owned: normalizeBool(e.owned, false),
    });

    await query(
      `INSERT INTO cellar_entries (id, created_at, updated_at, data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at, data = EXCLUDED.data`,
      [e.id, e.created_at, e.updated_at, JSON.stringify(data)],
    );
  }

  console.log(`Imported ${cellarDoc.entries.length} cellar entries, ${imageCount} images.`);
  console.log('Import complete.');
}

run()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
