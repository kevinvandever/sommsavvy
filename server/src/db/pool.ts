import pg from 'pg';
import { config } from '../config';

// pg parses BIGINT (int8) as a string by default to avoid precision loss.
// Our bigint columns hold unix-ms timestamps, which are well within the safe
// integer range, so parse them as numbers for ergonomic use in JS.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  // Railway Postgres works without TLS on the private network; enable a
  // relaxed TLS when connecting over a public proxy URL.
  ssl: /sslmode=require|railway|proxy\.rlwy/i.test(config.databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
});

export async function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<R>> {
  return pool.query<R>(text, params as never[]);
}
