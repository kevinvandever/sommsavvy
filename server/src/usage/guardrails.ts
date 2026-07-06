import { query } from '../db/pool';
import { config } from '../config';

/** Counter snapshot for the current UTC day. */
export type Counters = { global: number; identity: number; ip: number; anonCalls: number };

/**
 * Resolve the caller's identity for usage tracking.
 * Precedence: user:<id> > anon:<token> > ip:<addr>
 */
export function resolveIdentity(
  userId: string | undefined,
  anonToken: string | null,
  ip: string,
): { primary: string; ipKey: string; isSignedIn: boolean } {
  const ipKey = 'ip:' + ip;

  if (userId) {
    return { primary: 'user:' + userId, ipKey, isSignedIn: true };
  }
  if (anonToken !== null) {
    return { primary: 'anon:' + anonToken, ipKey, isSignedIn: false };
  }
  return { primary: ipKey, ipKey, isSignedIn: false };
}

/**
 * Returns the current UTC date as YYYY-MM-DD.
 */
export function getUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch usage counters for the current UTC day in a single query.
 * Missing rows are treated as 0.
 */
export async function getCounters(
  primary: string,
  ipKey: string,
): Promise<Counters> {
  const day = getUtcDay();

  // Deduplicate keys when primary === ipKey
  const keys = primary === ipKey
    ? ['global', primary]
    : ['global', primary, ipKey];

  const { rows } = await query<{
    identity: string;
    image_count: number;
    call_count: number;
  }>(
    'SELECT identity, image_count, call_count FROM ai_usage WHERE day = $1 AND identity = ANY($2)',
    [day, keys],
  );

  let global = 0;
  let identity = 0;
  let ip = 0;
  let anonCalls = 0;

  for (const row of rows) {
    if (row.identity === 'global') {
      global = row.image_count;
    } else if (row.identity === primary) {
      identity = row.image_count;
      anonCalls = row.call_count;
    }

    if (row.identity === ipKey) {
      ip = row.image_count;
    }
  }

  return { global, identity, ip, anonCalls };
}

/**
 * Compute how many images the caller is allowed to generate right now.
 * Returns the tightest constraint capped at `requestedCount`, plus an
 * optional notice explaining why images were reduced or unavailable.
 */
export function computeImageAllowance(
  counters: Counters,
  isSignedIn: boolean,
  requestedCount: number,
): { allowed: number; notice?: 'daily_limit' | 'images_unavailable' } {
  // Global remaining: anonymous users cannot draw from the signed-in reserved pool.
  const globalPool = isSignedIn
    ? config.dailyImageLimit
    : config.dailyImageLimit - config.signedInReservedImages;
  const globalRemaining = globalPool - counters.global;

  // Per-identity remaining depends on signed-in vs anonymous.
  const identityLimit = isSignedIn
    ? config.userDailyImageLimit
    : config.anonDailyImageLimit;
  const identityRemaining = identityLimit - counters.identity;

  // Per-IP remaining (applies to all callers).
  const ipRemaining = config.anonIpDailyImageLimit - counters.ip;

  const allowed = Math.max(
    0,
    Math.min(requestedCount, globalRemaining, identityRemaining, ipRemaining),
  );

  let notice: 'daily_limit' | 'images_unavailable' | undefined;
  if (allowed === 0 && globalRemaining <= 0) {
    notice = 'images_unavailable';
  } else if (allowed < requestedCount) {
    notice = 'daily_limit';
  }

  return { allowed, notice };
}

/**
 * Atomically increment image_count for global, primary identity, and IP key.
 * Only call this after successful image generation (never on provider failure).
 */
export async function incrementImageCount(
  primary: string,
  ipKey: string,
  count: number,
): Promise<void> {
  const day = getUtcDay();

  // Deduplicate: if primary === ipKey, don't double-count.
  const keys = Array.from(new Set(['global', primary, ipKey]));

  const promises = keys.map((identity) =>
    query(
      `INSERT INTO ai_usage (identity, day, image_count)
       VALUES ($1, $2, $3)
       ON CONFLICT (identity, day)
       DO UPDATE SET image_count = ai_usage.image_count + $3`,
      [identity, day, count],
    ),
  );

  await Promise.all(promises);
}

/**
 * Anonymous call gate. Returns whether the anonymous caller may proceed.
 * If allowed, atomically increments their call_count for the day.
 * When ANON_DAILY_CALL_LIMIT is 0 (email-required mode), always blocks.
 */
export async function checkAnonCallGate(
  anonIdentity: string,
): Promise<{ allowed: boolean }> {
  if (config.anonDailyCallLimit === 0) {
    return { allowed: false };
  }

  const day = getUtcDay();

  const { rows } = await query<{ call_count: number }>(
    `INSERT INTO ai_usage (identity, day, call_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (identity, day)
     DO UPDATE SET call_count = ai_usage.call_count + 1
     RETURNING call_count`,
    [anonIdentity, day],
  );

  const callCount = rows[0]?.call_count ?? 0;
  return { allowed: callCount <= config.anonDailyCallLimit };
}
