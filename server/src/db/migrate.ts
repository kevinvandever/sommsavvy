import { pool } from './pool';

// Idempotent schema setup. Safe to run on every deploy. Each table follows
// the adapter's storage model: id / created_at / updated_at columns plus a
// jsonb `data` column holding all user-defined fields, with a generated index
// on the hot lookup keys (email, userId).
const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id          text   PRIMARY KEY,
  created_at  bigint NOT NULL,
  updated_at  bigint NOT NULL,
  data        jsonb  NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users ((data->>'email'));

CREATE TABLE IF NOT EXISTS cellar_entries (
  id          text   PRIMARY KEY,
  created_at  bigint NOT NULL,
  updated_at  bigint NOT NULL,
  data        jsonb  NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS cellar_entries_user_idx ON cellar_entries ((data->>'userId'));

-- Email verification codes for passwordless auth. Not managed via the jsonb
-- adapter because these are short-lived, server-only records.
CREATE TABLE IF NOT EXISTS auth_verifications (
  id          text    PRIMARY KEY,
  email       text    NOT NULL,
  code_hash   text    NOT NULL,
  expires_at  bigint  NOT NULL,
  attempts    int     NOT NULL DEFAULT 0,
  consumed    boolean NOT NULL DEFAULT false,
  created_at  bigint  NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_verifications_email_idx ON auth_verifications (email);

-- Per-identity daily AI usage counters for cost guardrails.
CREATE TABLE IF NOT EXISTS ai_usage (
  identity     text NOT NULL,
  day          date NOT NULL,
  image_count  int  NOT NULL DEFAULT 0,
  call_count   int  NOT NULL DEFAULT 0,
  PRIMARY KEY (identity, day)
);
CREATE INDEX IF NOT EXISTS ai_usage_day_idx ON ai_usage (day);
`;

export async function migrate(): Promise<void> {
  await pool.query(SCHEMA);
}

// Allow running directly: `npm run migrate`.
import { pathToFileURL } from 'node:url';
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  migrate()
    .then(() => {
      console.log('Migration complete.');
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
