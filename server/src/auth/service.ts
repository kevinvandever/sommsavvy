import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { query } from '../db/pool';
import { config } from '../config';
import { Users, type User } from '../methods/tables/users';
import type { Hydrated } from '../db/adapter';
import { sendCodeEmail } from './email';
import { signSession } from './jwt';

// Error carrying a stable machine code, so the frontend can branch on
// e.code exactly as it did against the platform ('invalid_code', etc.).
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const CODE_TTL_MS = 10 * 60 * 1000; // ten minutes
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MS = 15 * 60 * 1000;

function hashCode(verificationId: string, code: string): string {
  // Salt the hash with the verification id and the server secret so stored
  // hashes are useless without both. Codes are short-lived and rate-limited.
  return createHash('sha256')
    .update(`${verificationId}:${code}:${config.jwtSecret}`)
    .digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function normalizeEmail(raw: string): string {
  const email = (raw || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new AuthError('invalid_email', 'Looks like a typo in that email.');
  }
  return email;
}

// Step 1: generate a code, persist its hash, deliver it. Returns the
// verificationId the client passes back to verify.
export async function sendEmailCode(rawEmail: string): Promise<{ verificationId: string; devCode?: string }> {
  const email = normalizeEmail(rawEmail);

  // Basic rate limit: cap sends per email per window.
  const since = Date.now() - SEND_WINDOW_MS;
  const recent = await query<{ count: string }>(
    `SELECT count(*)::int AS count FROM auth_verifications WHERE email = $1 AND created_at > $2`,
    [email, since],
  );
  if (Number(recent.rows[0]?.count ?? 0) >= MAX_SENDS_PER_WINDOW) {
    throw new AuthError('rate_limited', 'Too many attempts. Try again later.', 429);
  }

  const verificationId = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = Date.now();

  await query(
    `INSERT INTO auth_verifications (id, email, code_hash, expires_at, attempts, consumed, created_at)
     VALUES ($1, $2, $3, $4, 0, false, $5)`,
    [verificationId, email, hashCode(verificationId, code), now + CODE_TTL_MS, now],
  );

  await sendCodeEmail(email, code);

  // In dev mode only, surface the code to the caller so the auth flow can be
  // tested without inspecting email. Never set in production.
  return config.authDevCodes ? { verificationId, devCode: code } : { verificationId };
}

// Step 2: verify the code, find-or-create the user, issue a session token.
export async function verifyEmailCode(
  verificationId: string,
  code: string,
): Promise<{ token: string; user: Hydrated<User> }> {
  if (!verificationId || !code?.trim()) {
    throw new AuthError('invalid_code', 'Wrong code. Try again.');
  }

  const res = await query<{
    email: string;
    code_hash: string;
    expires_at: number;
    attempts: number;
    consumed: boolean;
  }>(
    `SELECT email, code_hash, expires_at, attempts, consumed
       FROM auth_verifications WHERE id = $1`,
    [verificationId],
  );
  const row = res.rows[0];

  if (!row || row.consumed) {
    throw new AuthError('invalid_code', 'Wrong code. Try again.');
  }
  if (Date.now() > Number(row.expires_at)) {
    throw new AuthError('verification_expired', 'Code expired. Send a new one.');
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new AuthError('max_attempts_exceeded', 'Too many tries. Send a new code.');
  }

  const matches = safeEqualHex(row.code_hash, hashCode(verificationId, code.trim()));
  if (!matches) {
    await query(`UPDATE auth_verifications SET attempts = attempts + 1 WHERE id = $1`, [
      verificationId,
    ]);
    const remaining = MAX_ATTEMPTS - (row.attempts + 1);
    if (remaining <= 0) {
      throw new AuthError('max_attempts_exceeded', 'Too many tries. Send a new code.');
    }
    throw new AuthError('invalid_code', 'Wrong code. Try again.');
  }

  // Single-use: consume the code.
  await query(`UPDATE auth_verifications SET consumed = true WHERE id = $1`, [verificationId]);

  // Find-or-create the user. New users get displayName defaulted to the local
  // part of their email, per the product spec.
  const email = row.email;
  const existing = await Users.filter((u, $) => u.email === $.email, { email });
  let user = existing[0];
  if (!user) {
    user = await Users.push({ email, displayName: email.split('@')[0] });
  }

  return { token: signSession(user.id), user };
}
