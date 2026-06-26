import { randomUUID } from 'node:crypto';
import { query } from './pool';

// A thin adapter that reproduces the slice of the MindStudio `db` API the
// SommSavvy methods rely on, backed by Postgres. The design goal is that the
// ported method files change as little as possible.
//
// Storage model: every table has four columns — id (text pk), created_at and
// updated_at (bigint unix ms, platform-managed), and data (jsonb holding all
// user-defined fields). A "row" handed back to method code is the flat merge
// { id, created_at, updated_at, ...data }, so existing accessors like
// `entry.id`, `entry.userId`, `entry.savedAt`, `user.email` all just work.

export type Hydrated<T> = T & {
  id: string;
  created_at: number;
  updated_at: number;
};

type Row = { id: string; created_at: number; updated_at: number; data: Record<string, unknown> };

function hydrate<T>(row: Row): Hydrated<T> {
  return { id: row.id, created_at: row.created_at, updated_at: row.updated_at, ...(row.data as T) };
}

// Drop platform-managed keys and undefined values before persisting. Undefined
// means "not provided", so it should never overwrite or create a field.
function cleanForWrite(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k === 'created_at' || k === 'updated_at') continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

type Bindings = Record<string, unknown> | undefined;
type Predicate<T, B extends Bindings> = (e: Hydrated<T>, $: B) => boolean;

interface PredicateEntry<T> {
  pred: Predicate<T, Bindings>;
  bindings: Bindings;
}

// A lazily-executed, chainable query. It is also a thenable: awaiting it (or
// passing it to db.batch / Promise.all) runs the query and resolves to the
// hydrated rows. Mirrors `.filter().sortBy().reverse().take()`.
class Query<T> implements PromiseLike<Hydrated<T>[]> {
  private predicates: PredicateEntry<T>[] = [];
  private sortKey: ((e: Hydrated<T>) => number | string) | null = null;
  private reversed = false;
  private limit: number | null = null;

  constructor(private readonly table: string) {}

  filter<B extends Bindings>(pred: Predicate<T, B>, bindings?: B): this {
    this.predicates.push({ pred: pred as Predicate<T, Bindings>, bindings });
    return this;
  }

  sortBy(fn: (e: Hydrated<T>) => number | string): this {
    this.sortKey = fn;
    return this;
  }

  reverse(): this {
    this.reversed = !this.reversed;
    return this;
  }

  take(n: number): this {
    this.limit = n;
    return this;
  }

  // Pull the first userId binding (if any) so we can scope the SQL fetch to
  // one user's rows instead of scanning the whole table. Every real query in
  // this app filters by userId, so this keeps fetches narrow; the JS
  // predicate pass below still enforces full correctness.
  private userIdBinding(): string | null {
    for (const { bindings } of this.predicates) {
      const v = bindings?.userId;
      if (typeof v === 'string') return v;
    }
    return null;
  }

  private async run(): Promise<Hydrated<T>[]> {
    const userId = this.userIdBinding();
    let rows: Row[];
    if (userId) {
      const res = await query<Row>(
        `SELECT id, created_at, updated_at, data FROM "${this.table}" WHERE data->>'userId' = $1`,
        [userId],
      );
      rows = res.rows;
    } else {
      const res = await query<Row>(
        `SELECT id, created_at, updated_at, data FROM "${this.table}"`,
      );
      rows = res.rows;
    }

    let items = rows.map((r) => hydrate<T>(r));

    // Apply every predicate in JS for exact fidelity with the original
    // closure semantics (equality on userId/kind, etc.).
    for (const { pred, bindings } of this.predicates) {
      items = items.filter((e) => pred(e, bindings));
    }

    if (this.sortKey) {
      const key = this.sortKey;
      items.sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        if (ka < kb) return -1;
        if (ka > kb) return 1;
        return 0;
      });
    }
    if (this.reversed) items.reverse();
    if (this.limit != null) items = items.slice(0, this.limit);

    return items;
  }

  then<R1 = Hydrated<T>[], R2 = never>(
    onfulfilled?: ((value: Hydrated<T>[]) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }

  async count(): Promise<number> {
    return (await this.run()).length;
  }
}

export interface TableOptions<T> {
  defaults?: Partial<T>;
}

export class Table<T> {
  constructor(
    private readonly name: string,
    private readonly options: TableOptions<T> = {},
  ) {}

  get tableName(): string {
    return this.name;
  }

  async get(id: string): Promise<Hydrated<T> | null> {
    const res = await query<Row>(
      `SELECT id, created_at, updated_at, data FROM "${this.name}" WHERE id = $1`,
      [id],
    );
    const row = res.rows[0];
    return row ? hydrate<T>(row) : null;
  }

  async push(obj: Partial<T>): Promise<Hydrated<T>> {
    const id = randomUUID();
    const now = Date.now();
    const data = { ...(this.options.defaults ?? {}), ...cleanForWrite(obj as Record<string, unknown>) };
    const res = await query<Row>(
      `INSERT INTO "${this.name}" (id, created_at, updated_at, data)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, created_at, updated_at, data`,
      [id, now, now, JSON.stringify(data)],
    );
    return hydrate<T>(res.rows[0]!);
  }

  async update(id: string, patch: Partial<T>): Promise<Hydrated<T>> {
    const existing = await query<Row>(
      `SELECT data FROM "${this.name}" WHERE id = $1`,
      [id],
    );
    const current = existing.rows[0]?.data ?? {};
    const merged: Record<string, unknown> = { ...current };
    // Apply the patch: undefined clears a field, anything else sets it.
    for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
      if (k === 'id' || k === 'created_at' || k === 'updated_at') continue;
      if (v === undefined) delete merged[k];
      else merged[k] = v;
    }
    const now = Date.now();
    const res = await query<Row>(
      `UPDATE "${this.name}" SET data = $2::jsonb, updated_at = $3
       WHERE id = $1
       RETURNING id, created_at, updated_at, data`,
      [id, JSON.stringify(merged), now],
    );
    return hydrate<T>(res.rows[0]!);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const res = await query(`DELETE FROM "${this.name}" WHERE id = $1`, [id]);
    return { deleted: (res.rowCount ?? 0) > 0 };
  }

  // Find-or-create keyed on a single data field (e.g. email). Used by seeds.
  async upsert(keyField: keyof T & string, obj: Partial<T>): Promise<Hydrated<T>> {
    const keyValue = (obj as Record<string, unknown>)[keyField];
    const found = await query<Row>(
      `SELECT id FROM "${this.name}" WHERE data->>'${keyField}' = $1 LIMIT 1`,
      [String(keyValue)],
    );
    const existingId = found.rows[0]?.id;
    if (existingId) return this.update(existingId, obj);
    return this.push(obj);
  }

  filter<B extends Bindings>(pred: Predicate<T, B>, bindings?: B): Query<T> {
    return new Query<T>(this.name).filter(pred, bindings);
  }

  async count<B extends Bindings>(pred: Predicate<T, B>, bindings?: B): Promise<number> {
    return new Query<T>(this.name).filter(pred, bindings).count();
  }
}

export const db = {
  defineTable<T>(name: string, options: TableOptions<T> = {}): Table<T> {
    return new Table<T>(name, options);
  },

  // Resolves a set of awaitables (queries or promises) together.
  batch<T extends readonly unknown[] | []>(
    ...items: T
  ): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
    return Promise.all(items) as Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }>;
  },

  // Current time as unix milliseconds, matching the platform's db.now().
  now(): number {
    return Date.now();
  },
};

export type Db = typeof db;
