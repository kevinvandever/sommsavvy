import { db, auth } from '../runtime';
import { CellarEntries, type CellarEntry } from './tables/cellarEntries';
import { config } from '../config';
import { logEvent, CELLAR_IMPORTED } from '../observability/events';
import type { Hydrated } from '../db/adapter';

// Commits reviewed import rows to the cellar in one action.
//
// Two invariants this method upholds deliberately:
//
// 1. Imported bottles are ON HAND but NOT TASTED (owned: true, tasted: false).
//    A shipment is wine you hold and have not opened. This is the inverse of
//    the scan path, which records something tasted.
//
// 2. NO taste-summary regeneration. The taste profile derives from tasted
//    entries only, so regenerating here would be a no-op at best and N
//    redundant background jobs at worst. The existing invariant (regen fires
//    on saves of tasted material, removes, profile-relevant updates, and
//    explicit refresh) is preserved by simply not firing.
//
// Also: no portrait/image generation. Imported rows carry no photoUrl and the
// cellar tile falls back to its deterministic placeholder.

const KINDS = ['wine', 'beer', 'spirits'] as const;

export interface BulkEntryInput {
  name: string;
  kind: 'wine' | 'beer' | 'spirits';
  producer?: string;
  region?: string;
  vintage?: number;
  abv?: number;
}

export interface SaveCellarEntriesBulkInput {
  entries: BulkEntryInput[];
}

export interface SaveCellarEntriesBulkResult {
  saved: Hydrated<CellarEntry>[];
  rejected: Array<{ index: number; reason: string }>;
}

export async function saveCellarEntriesBulk(
  input: SaveCellarEntriesBulkInput,
): Promise<SaveCellarEntriesBulkResult> {
  if (!auth.userId) {
    throw new Error('Sign in to save to your cellar.');
  }
  const userId = auth.userId;

  const entries = Array.isArray(input.entries) ? input.entries : [];
  if (entries.length === 0) {
    throw new Error('Nothing to add.');
  }
  if (entries.length > config.importBatchLimit) {
    throw new Error(`That is more than ${config.importBatchLimit} bottles at once.`);
  }

  const saved: Hydrated<CellarEntry>[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];
  const now = db.now();

  // Partial success: one bad row does not lose the rest of the shipment.
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const reason = validate(e);
    if (reason) {
      rejected.push({ index: i, reason });
      continue;
    }

    try {
      const entry = await CellarEntries.push({
        userId,
        kind: e.kind,
        name: e.name.trim(),
        producer: e.producer?.trim() || undefined,
        region: e.region?.trim() || undefined,
        vintage: e.vintage,
        abv: e.abv,
        source: 'import',
        savedAt: now,
        // On hand, not yet tasted. See invariant 1 above.
        owned: true,
        tasted: false,
      });
      saved.push(entry);
    } catch (err) {
      console.error('Bulk import row failed:', err);
      rejected.push({ index: i, reason: 'Could not be saved.' });
    }
  }

  logEvent(CELLAR_IMPORTED, {
    userId,
    savedCount: saved.length,
    rejectedCount: rejected.length,
  });

  // No taste regeneration. See invariant 2 above.
  return { saved, rejected };
}

/** Same field rules as saveCellarEntry. Returns a reason string, or null when valid. */
export function validate(e: BulkEntryInput): string | null {
  if (!e || typeof e !== 'object') return 'Not a valid entry.';
  if (!e.name?.trim()) return 'Needs a name.';
  if (!(KINDS as readonly string[]).includes(e.kind)) return 'Needs to be wine, beer, or spirits.';
  if (e.vintage != null) {
    const max = new Date().getFullYear() + 1;
    if (!Number.isFinite(e.vintage) || e.vintage < 1900 || e.vintage > max) {
      return `Vintage must be between 1900 and ${max}.`;
    }
  }
  if (e.abv != null && (!Number.isFinite(e.abv) || e.abv < 0 || e.abv > 100)) {
    return 'ABV looks off.';
  }
  return null;
}
