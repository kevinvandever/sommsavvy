# Implementation Plan: Cost Guardrails & Abuse Control

## Overview

A thin enforcement layer in front of the AI methods (`pocketSomm`, `reverseScan`) that bounds daily image spend, enforces per-identity quotas, reserves capacity for signed-in users, applies per-IP burst rate limiting, supports configurable anonymous launch modes, and emits structured launch instrumentation events. Built as a `server/src/usage/` module with a Postgres `ai_usage` table for durable counters and an in-memory sliding-window limiter for burst protection.

## Tasks

- [x] 1. Configuration and database schema
  - [x] 1.1 Add cost-guardrail environment variables to `server/src/config.ts`
    - Add numeric env vars with defaults: `DAILY_IMAGE_LIMIT` (300), `USER_DAILY_IMAGE_LIMIT` (20), `ANON_DAILY_IMAGE_LIMIT` (5), `ANON_IP_DAILY_IMAGE_LIMIT` (15), `SIGNEDIN_RESERVED_IMAGES` (90), `AI_RATE_PER_MIN` (12), `ANON_DAILY_CALL_LIMIT` (0), `POCKET_SOMM_IMAGE_COUNT` (1)
    - Clamp `SIGNEDIN_RESERVED_IMAGES` to never exceed `DAILY_IMAGE_LIMIT`
    - _Requirements: 5.1, 5.2, 5.3, 6.1_

  - [x] 1.2 Add `ai_usage` table to `server/src/db/migrate.ts`
    - Add `CREATE TABLE IF NOT EXISTS ai_usage (identity text, day date, image_count int NOT NULL DEFAULT 0, call_count int NOT NULL DEFAULT 0, PRIMARY KEY (identity, day))`
    - Add an index on `day` for efficient pruning/querying
    - _Requirements: 1.3, 2.4_

  - [x] 1.3 Update `server/.env.example` with all new guardrail env vars
    - Document each variable with its default and a one-line explanation
    - _Requirements: 5.1, 5.2, 5.3, 6.1_

- [x] 2. In-memory per-IP rate limiter
  - [x] 2.1 Create `server/src/usage/rateLimit.ts`
    - Implement a sliding-window counter keyed by client IP: store an array of request timestamps per IP
    - Export `checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number }` — counts timestamps within the last 60 seconds against `AI_RATE_PER_MIN` from config
    - Prune entries older than 60 seconds on each access to bound memory
    - Export `recordRequest(ip: string): void` — pushes the current timestamp into the window (called only when the request proceeds)
    - _Requirements: 4.1, 4.2_

  - [ ]* 2.2 Write unit tests for rate limiter
    - Test that requests at or under the limit pass
    - Test that the request exceeding the limit is rejected with a positive `retryAfterMs`
    - Test that old entries expire and the window rolls forward
    - _Requirements: 4.1_

- [x] 3. Client IP and anonymous identity helpers
  - [x] 3.1 Create `server/src/usage/clientIp.ts`
    - Export `getClientIp(c: Context): string` — extract from `X-Forwarded-For` (rightmost entry = proxy-appended), fall back to socket remote address
    - Export `getAnonToken(c: Context): string | null` — read the `X-Anon-Id` header
    - _Requirements: 4.2, 7 (edge case: missing X-Forwarded-For)_

- [x] 4. Guardrails module — identity resolution and counter logic
  - [x] 4.1 Create `server/src/usage/guardrails.ts` — identity resolution and counter reads
    - Export `resolveIdentity(userId: string | undefined, anonToken: string | null, ip: string): { primary: string; ipKey: string; isSignedIn: boolean }` — precedence: `user:<id>` > `anon:<token>` > `ip:<addr>`
    - Export `getUtcDay(): string` — returns current UTC date as `YYYY-MM-DD`
    - Export `getCounters(primary: string, ipKey: string): Promise<{ global: number; identity: number; ip: number; anonCalls: number }>` — single SELECT fetching rows for `['global', primary, ipKey]` for the current UTC day; missing rows treated as 0
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 Add allowance computation and increment logic to `server/src/usage/guardrails.ts`
    - Export `computeImageAllowance(counters: Counters, isSignedIn: boolean, requestedCount: number): { allowed: number; notice?: 'daily_limit' | 'images_unavailable' }` — applies: global ceiling (minus reserved pool for anon), per-identity limit, per-IP limit; returns the min of remaining across all constraints capped at `requestedCount`
    - Export `incrementImageCount(primary: string, ipKey: string, count: number): Promise<void>` — atomic `INSERT … ON CONFLICT DO UPDATE` incrementing `image_count` for `global`, `primary`, and `ipKey` rows
    - Export `checkAnonCallGate(anonIdentity: string): Promise<{ allowed: boolean }>` — reads `call_count` vs `ANON_DAILY_CALL_LIMIT`; if allowed, atomically increments `call_count`; if `ANON_DAILY_CALL_LIMIT` = 0, immediately returns `{ allowed: false }`
    - Only increment image counts on successful generation (never on provider failure)
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 5.1, 5.2, 7.1, 7.2_

  - [ ]* 4.3 Write unit tests for guardrails module
    - Test identity resolution precedence (user > anon > ip)
    - Test `computeImageAllowance` — global ceiling blocks all, reserved pool blocks anon but not signed-in, per-identity limit, per-IP limit, returns correct `notice`
    - Test `checkAnonCallGate` when `ANON_DAILY_CALL_LIMIT = 0` rejects immediately
    - Test UTC day boundary (different days = independent counters)
    - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [x] 5. Checkpoint — Config, schema, rate limiter, and guardrails compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate guardrails into the route layer
  - [x] 6.1 Add rate-limit and anon-call-gate checks to AI routes in `server/src/methods/routes.ts`
    - Before the SSE streaming begins for `/pocketSomm` and `/reverseScan`: extract client IP via `getClientIp`, anon token via `getAnonToken`
    - Check rate limit → if over, respond HTTP 429 with `{ error: { code: 'rate_limited', message: '...', retryAfter: <seconds> } }` and do NOT invoke the method
    - If anonymous: check call gate → if blocked (limit reached or `ANON_DAILY_CALL_LIMIT=0`), respond HTTP 401 with `{ error: { code: 'sign_in_required', message: '...' } }` and do NOT invoke the method
    - Record the rate-limit timestamp only when proceeding
    - _Requirements: 4.1, 5.1, 5.2, 5.3, 8.3_

- [x] 7. Integrate image-allowance checks into AI methods
  - [x] 7.1 Update `server/src/methods/pocketSomm.ts` to respect image allowance
    - After text recommendations are streamed, resolve identity and fetch counters
    - Call `computeImageAllowance` with `POCKET_SOMM_IMAGE_COUNT` as the requested count
    - Generate only the allowed number of images (may be 0); skip the batch call entirely if 0
    - On each successful image generation, call `incrementImageCount` with the count of successes
    - On provider failure for an image, do NOT increment
    - Attach `notice` field to the final SSE result when images are partially or fully skipped
    - _Requirements: 1.1, 2.1, 2.2, 3.1, 6.1, 7.1, 7.2, 8.1, 8.2_

  - [x] 7.2 Update `server/src/methods/reverseScan.ts` to respect image allowance
    - After text card is streamed, resolve identity and fetch counters
    - Call `computeImageAllowance` with `1` as the requested count
    - Generate image only if `allowed > 0`; otherwise skip entirely
    - On success, call `incrementImageCount` with 1; on failure, do NOT increment
    - Attach `notice` field to the response when the portrait is skipped
    - _Requirements: 1.1, 2.1, 2.2, 3.1, 7.1, 7.2, 8.1, 8.2_

- [x] 8. Checkpoint — Full guardrail flow compiles and wires together
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Launch instrumentation
  - [x] 9.1 Create `server/src/observability/events.ts`
    - Export `logEvent(event: string, data: Record<string, unknown>): void` — writes a single-line JSON object to stdout with fields: `{ event, ts: ISO timestamp, ...data }`
    - Define and export event name constants: `SCAN_STARTED`, `SCAN_SUCCEEDED`, `SCAN_FAILED`, `CELLAR_SAVED`, `SIGNED_UP`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 9.2 Emit `scan_started`, `scan_succeeded`, `scan_failed` in `pocketSomm.ts` and `reverseScan.ts`
    - `scan_started`: at method entry, log timestamp, method name (`pocketSomm` / `reverseScan`), identity type (`user` / `anon`)
    - `scan_succeeded`: before returning the final result
    - `scan_failed`: in the catch path, with a reason category (e.g. `provider_error`, `input_error`)
    - _Requirements: 9.1, 9.2_

  - [x] 9.3 Emit `cellar_saved` in `server/src/methods/saveCellarEntry.ts`
    - Log after the entry is persisted, include entry id and user id
    - _Requirements: 9.3_

  - [x] 9.4 Emit `signed_up` in `server/src/auth/service.ts`
    - Log inside `verifyEmailCode` when a new user is created (the `if (!user)` branch), include user id
    - _Requirements: 9.4_

- [x] 10. Final checkpoint — Ensure everything compiles and tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirement story.criteria numbers from requirements.md
- Checkpoints ensure incremental validation
- The design specifies TypeScript throughout, matching the existing Hono + Postgres server stack
- The `ai_usage` table uses `INSERT … ON CONFLICT` for atomic count-on-success semantics
- The in-memory rate limiter is per-instance (single-instance assumption for launch)
- All image limits degrade to text-only; only the rate limit (429) and anon call gate (401) hard-block
- Identity is resolved from `X-Forwarded-For` (IP) and `X-Anon-Id` (device token) headers plus the auth middleware's `userId`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1", "9.1"] },
    { "id": 2, "tasks": ["2.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["7.1", "7.2"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4"] }
  ]
}
```
