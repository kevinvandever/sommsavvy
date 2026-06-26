import { auth } from '../runtime';
import { CellarEntries } from './tables/cellarEntries';

interface ListInput {
  kind?: 'wine' | 'beer' | 'spirits';
  search?: string;
  sort?: 'recent' | 'tasted';
}

export async function listCellar(input: ListInput = {}) {
  if (!auth.userId) {
    throw new Error('Sign in to view your cellar.');
  }

  const userId = auth.userId;

  // Start narrow: rows owned by the current user, compiled to SQL.
  let q = CellarEntries.filter(
    (e, $) => e.userId === $.userId,
    { userId }, // bindings: lifts closure var so filter compiles to SQL
  );

  if (input.kind) {
    const kind = input.kind;
    q = q.filter(
      (e, $) => e.kind === $.kind,
      { kind }, // bindings: lifts closure var so filter compiles to SQL
    );
  }

  // Default: most-recently-saved first.
  let entries = await q.sortBy((e) => e.savedAt).reverse();

  // Substring search runs in JS over the user's already-narrow set.
  if (input.search?.trim()) {
    const needle = input.search.trim().toLowerCase();
    entries = entries.filter((e) => {
      const hay = [e.name, e.producer, e.region, e.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  // Resort if requested.
  if (input.sort === 'tasted') {
    entries = entries
      .filter((e) => typeof e.tastedAt === 'number')
      .sort((a, b) => (b.tastedAt || 0) - (a.tastedAt || 0));
  }

  return { entries };
}
