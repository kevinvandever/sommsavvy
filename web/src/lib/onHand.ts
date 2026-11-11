// Client mirror of the server's on-hand rules (server/src/methods/common/onHand.ts),
// plus the rack check's staging helpers and the copy they produce.
//
// The mirror exists only to draw optimistic state. Every server response
// replaces the client's copy, so if the two ever drift, the next response
// corrects it. Every decision the entry card and the rack check make lives
// here so it can be unit tested without a DOM.

import type { CellarEntry, OnHandSnapshot } from '../types';

export const MAX_BOTTLES = 99;
export type Outcome = 'drank' | 'gave_away';

function isValidBottleCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_BOTTLES;
}

// 0 when the entry is not on hand; otherwise the stored count, read as 1 when
// absent or invalid. Mirrors the server.
export function bottlesOnHand(e: Pick<CellarEntry, 'owned' | 'bottleCount'>): number {
  if (e.owned !== true) return 0;
  return isValidBottleCount(e.bottleCount) ? e.bottleCount : 1;
}

// The entry as the server will leave it after one bottle goes with this
// outcome. "Drank it" marks it tasted; "Gave it away" leaves tasted alone.
// An entry with nothing on hand is returned unchanged (the server rejects it).
export function previewOutcome(e: CellarEntry, outcome: Outcome): CellarEntry {
  const n = bottlesOnHand(e);
  if (n === 0) return e;
  const left = n - 1;
  const next: CellarEntry = { ...e, owned: left > 0 };
  if (left > 0) next.bottleCount = left;
  else delete next.bottleCount;
  if (outcome === 'drank') next.tasted = true;
  return next;
}

// Applies an updateCellarEntry patch the way the server resolves it, for an
// optimistic redraw. owned false clears the count. owned true takes the patch
// count, else the current count when on hand, else 1. A count alone sets
// owned true. Other patch fields (such as tasted) are spread as given.
export function applyOnHandPatch(e: CellarEntry, patch: Partial<CellarEntry>): CellarEntry {
  const { owned, bottleCount, ...rest } = patch;
  const next: CellarEntry = { ...e, ...rest };
  const ownedGiven = owned !== undefined && owned !== null;
  const countGiven = bottleCount !== undefined && bottleCount !== null;
  if (!ownedGiven && !countGiven) return next;

  if (owned === false) {
    next.owned = false;
    delete next.bottleCount;
    return next;
  }
  next.owned = true;
  next.bottleCount = countGiven ? bottleCount : bottlesOnHand(e) || 1;
  return next;
}

// The updateCellarEntry patch that reverses an outcome. tasted is included
// only when the outcome changed it, so undoing "Gave it away", or a "Drank it"
// on a bottle that was already tasted, starts no taste regeneration.
export function undoPatchFor(
  previous: OnHandSnapshot,
  after: Pick<CellarEntry, 'tasted'>,
): Partial<CellarEntry> {
  const patch: Partial<CellarEntry> = { owned: true, bottleCount: previous.bottleCount };
  if (previous.tasted !== (after.tasted !== false)) patch.tasted = previous.tasted;
  return patch;
}

// The line shown beside Undo after an outcome on the entry page.
export function outcomeMessage(outcome: Outcome, left: number): string {
  if (outcome === 'drank') return left > 0 ? `One down. ${left} left.` : 'Finished.';
  return left > 0 ? `One given away. ${left} left.` : 'Off the rack.';
}

// ---------------------------------------------------------------------------
// Rack check staging. Rows are a snapshot of the on-hand entries; marks stay
// local until the user confirms.
// ---------------------------------------------------------------------------

export interface RackRow {
  entry: CellarEntry;
  onHand: number;
  drank: number;
  gaveAway: number;
}

// Every on-hand entry, sorted by name, then producer.
export function toRackRows(cellar: CellarEntry[]): RackRow[] {
  const cmp = (a: string | undefined, b: string | undefined) =>
    (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' });
  return cellar
    .filter((e) => e.owned === true)
    .map((entry) => ({ entry, onHand: bottlesOnHand(entry), drank: 0, gaveAway: 0 }))
    .sort((a, b) => cmp(a.entry.name, b.entry.name) || cmp(a.entry.producer, b.entry.producer));
}

export function rowLeft(row: RackRow): number {
  return row.onHand - row.drank - row.gaveAway;
}

// Marks one more bottle gone with this outcome. Unchanged once none are left.
export function stage(row: RackRow, outcome: Outcome): RackRow {
  if (rowLeft(row) <= 0) return row;
  return outcome === 'drank'
    ? { ...row, drank: row.drank + 1 }
    : { ...row, gaveAway: row.gaveAway + 1 };
}

export function resetRow(row: RackRow): RackRow {
  return { ...row, drank: 0, gaveAway: 0 };
}

// What the row has marked, or null while it is unmarked. A one-bottle row
// names its outcome; a larger row counts each outcome and what is left.
export function rowStatus(row: RackRow): string | null {
  if (row.drank + row.gaveAway === 0) return null;
  if (row.onHand === 1) return row.drank > 0 ? 'Drank it.' : 'Gave it away.';
  const parts: string[] = [];
  if (row.drank > 0) parts.push(`Drank ${row.drank}`);
  if (row.gaveAway > 0) parts.push(`gave away ${row.gaveAway}`);
  const joined = parts.join(', ');
  const left = rowLeft(row);
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}. ${left > 0 ? `${left} left.` : 'None left.'}`;
}

// The request items for every marked row.
export function outcomeItems(rows: RackRow[]): Array<{ id: string; drank: number; gaveAway: number }> {
  return rows
    .filter((r) => r.drank + r.gaveAway > 0)
    .map((r) => ({ id: r.entry.id, drank: r.drank, gaveAway: r.gaveAway }));
}

// Total bottles marked gone across the rack check.
export function stagedBottles(rows: RackRow[]): number {
  return rows.reduce((sum, r) => sum + r.drank + r.gaveAway, 0);
}
