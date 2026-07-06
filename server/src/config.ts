// Centralized environment config. Reads process.env once and exposes a typed,
// validated object. Throws early on missing required values so a
// misconfigured deploy fails loudly at boot rather than mid-request.

// Load .env (if present) before reading any values. In production (Railway,
// Netlify) real env vars are already set, and the missing .env is ignored.
import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function optional(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

function bool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
}

export const config = {
  port: Number(process.env.PORT) || 8787,
  // Public base URL of THIS backend, used to build absolute URLs for stored
  // files (generated images, uploads). On Railway set this to the service's
  // public URL. Defaults to localhost for dev.
  get publicBaseUrl(): string {
    const v = (process.env.PUBLIC_BASE_URL ?? '').trim().replace(/\/$/, '');
    return v || `http://localhost:${Number(process.env.PORT) || 8787}`;
  },
  // Allowed CORS origins. Empty list means "reflect any origin" (dev only).
  corsOrigins: optional('CORS_ORIGINS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '30d'),
  // When true, email codes are logged to the console instead of emailed.
  authDevCodes: bool('AUTH_DEV_CODES', false),

  resendApiKey: optional('RESEND_API_KEY'),
  emailFrom: optional('EMAIL_FROM', 'SommSavvy <onboarding@resend.dev>'),

  anthropicApiKey: optional('ANTHROPIC_API_KEY'),
  geminiApiKey: optional('GEMINI_API_KEY'),
  openaiApiKey: optional('OPENAI_API_KEY'),

  // Model IDs, overridable via env so you can bump versions without code
  // changes. Defaults verified current as of this build.
  models: {
    text: optional('AI_TEXT_MODEL', 'claude-haiku-4-5'),
    vision: optional('AI_VISION_MODEL', 'gemini-2.5-flash'),
    image: optional('AI_IMAGE_MODEL', 'gemini-2.5-flash-image'),
    transcribe: optional('AI_TRANSCRIBE_MODEL', 'gpt-4o-transcribe'),
  },

  r2: {
    accountId: optional('R2_ACCOUNT_ID'),
    accessKeyId: optional('R2_ACCESS_KEY_ID'),
    secretAccessKey: optional('R2_SECRET_ACCESS_KEY'),
    bucket: optional('R2_BUCKET', 'sommsavvy'),
    publicBaseUrl: optional('R2_PUBLIC_BASE_URL'),
  },

  // ---- Cost Guardrails ----
  dailyImageLimit: Number(optional('DAILY_IMAGE_LIMIT', '300')),
  userDailyImageLimit: Number(optional('USER_DAILY_IMAGE_LIMIT', '20')),
  anonDailyImageLimit: Number(optional('ANON_DAILY_IMAGE_LIMIT', '5')),
  anonIpDailyImageLimit: Number(optional('ANON_IP_DAILY_IMAGE_LIMIT', '15')),
  get signedInReservedImages(): number {
    const raw = Number(optional('SIGNEDIN_RESERVED_IMAGES', '90'));
    return Math.min(raw, this.dailyImageLimit);
  },
  aiRatePerMin: Number(optional('AI_RATE_PER_MIN', '12')),
  anonDailyCallLimit: Number(optional('ANON_DAILY_CALL_LIMIT', '0')),
  pocketSommImageCount: Number(optional('POCKET_SOMM_IMAGE_COUNT', '1')),

  get isProd(): boolean {
    return process.env.NODE_ENV === 'production';
  },
};

export type Config = typeof config;
