## Design — Cost Guardrails & Abuse Control

> Companion to the requirements doc. Covers *how*: data, flows, states, decisions.

## 1. Overview

A thin enforcement layer in front of the AI methods. Durable per-day counters live in a Postgres `ai_usage` table keyed by identity; an in-memory token bucket handles per-IP burst. A `guardrails` module answers three questions — "is this caller allowed to make an AI call?", "may I generate one more image for this caller?", and "record a successful image" — while the route layer applies the per-IP rate limit and the anonymous call gate. Images degrade to text-only when limits are hit; only the rate limit and the anonymous-call gate hard-block.

**Where it lives:**
- `server/src/usage/guardrails.ts` — identity resolution, counter reads/writes, allowance logic.
- `server/src/usage/rateLimit.ts` — in-memory per-IP token bucket.
- `server/src/db/migrate.ts` — new `ai_usage` table.
- `server/src/methods/routes.ts` — rate-limit + anon-call gate on the AI routes.
- `server/src/methods/pocketSomm.ts` / `reverseScan.ts` — image-allowance checks around generation.
- `server/src/config.ts` — new env vars.
- `server/src/observability/events.ts` — structured event logging.

## 2. Data model

| Entity           | Key fields                                                   | Notes / relationships                                        |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `ai_usage`       | `identity: text`, `day: date`, `image_count: int`, `call_count: int`, PK `(identity, day)` | One row per identity per UTC day. `identity` ∈ `global` \| `user:<id>` \| `anon:<token>` \| `ip:<addr>`. `image_count` for all; `call_count` used for `anon:<token>` (the launch-mode gate). |
| in-memory bucket | `ip → recent request timestamps`                             | Per-IP burst window. Not persisted; rebuilt on restart. Pruned periodically. |
| events           | (none — emitted as structured log lines)                     | No storage in v1.                                            |

A single read fetches every counter relevant to a request: `SELECT identity, image_count, call_count FROM ai_usage WHERE day = $today AND identity = ANY($keys)` where `$keys` = `['global', 'user:<id>' or 'anon:<token>', 'ip:<addr>']`.

Atomic increment (count-on-success):
```sql
INSERT INTO ai_usage (identity, day, image_count) VALUES ($1, $2, 1)
ON CONFLICT (identity, day) DO UPDATE SET image_count = ai_usage.image_count + 1
RETURNING image_count;
```

`day` is the app-computed UTC date string, so the reset boundary is deterministic.

## 3. Roles & permissions

| Role             | Can do                                                       | Cannot do                                                    |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Anonymous caller | Make AI calls and earn images up to `ANON_*` limits (subject to launch mode) | Exceed anon image/call limits; touch the `SIGNEDIN_RESERVED_IMAGES` slice |
| Signed-in caller | Higher per-day image quota; draws on the reserved pool       | Exceed `USER_DAILY_IMAGE_LIMIT` or the global ceiling        |
| Operator         | Tune all limits + launch mode via env                        | (no runtime UI; config only)                                 |

## 4. Primary flow

An AI request (`pocketSomm` / `reverseScan`) through the guardrails:

1. Route resolves client IP from `X-Forwarded-For` and identity (`user:<id>` if authed, else `anon:<token>` from the `X-Anon-Id` header, else `ip:<addr>`).
2. Per-IP rate limit (in-memory). Over `AI_RATE_PER_MIN` in the rolling 60s → HTTP 429, no provider call.
3. Anon call gate. If anonymous: if `call_count(anon) ≥ ANON_DAILY_CALL_LIMIT` → HTTP 401 `sign_in_required`, no provider call. Otherwise increment the anon `call_count`.
4. Method runs and produces text recommendations/card (always returned).
5. Compute image budget = `min(POCKET_SOMM_IMAGE_COUNT or 1, allowanceRemaining(identity, ip))`, where `allowanceRemaining` is the tightest of: global remaining (minus reserved pool if anonymous), per-identity remaining, per-IP remaining.
6. Generate up to that many images. On each success, atomically increment `global` + identity + `ip:<addr>` image counts. On failure, no increment.
7. Response returns text + whatever images succeeded + a machine-readable `notice` (`daily_limit` / `images_unavailable` / none).

## 5. States to handle

This is a backend feature; "states" are response conditions the frontend must render:

- Normal: images present, no notice.
- Per-user / per-anon limit reached: text-only, `notice: "daily_limit"` → UI shows "today's portraits are used up — sign in for more" (signed-in: "back tomorrow").
- Global ceiling reached: text-only, `notice: "images_unavailable"` → UI shows a quiet "portraits are resting" line; recommendations still shine.
- Rate limited: HTTP 429 → UI shows a brief "slow down a moment" and lets them retry.
- Anon over call limit / email-required mode: HTTP 401 `sign_in_required` → UI opens the auth sheet.
- Provider image failure: that image is simply absent; card still renders (already best-effort).
- First-run: no special handling — limits are per-day, not per-account-age.

## 6. Key decisions & tradeoffs

- Decision: Postgres for durable counters. Why: already provisioned, no new infra, survives restarts. Tradeoff: a little DB traffic per AI call — negligible at this scale.
- Decision: In-memory per-IP rate limiter. Why: simplest thing that stops bursts. Tradeoff: per-instance only → single-instance assumption for launch (documented as the riskiest assumption).
- Decision: Count images on success, with a pre-generation read. Why: never charge a user for our provider failures; keeps logic simple. Tradeoff: minor over-allowance under high concurrency — acceptable for a soft budget.
- Decision: Identity precedence `user > anon-token > ip`. Why: most accurate signal available. Tradeoff: anon token is bypassable; the per-IP image backstop mitigates.
- Decision: Only the rate limit and anon-call gate hard-block; all image limits degrade to text. Why: preserves the experience while bounding the real cost (images). Tradeoff: text generation still costs a little past the image ceiling — bounded by the rate limit.
- Decision: UTC day boundary. Why: one global, deterministic reset. Tradeoff: not user-local — irrelevant for cost control.

## 7. Edge cases & error handling

- No counter row yet (first call of the day): treated as 0 via `INSERT … ON CONFLICT`.
- Missing `X-Forwarded-For`: fall back to the socket remote address; localhost in dev.
- Anonymous with no `X-Anon-Id`: identity becomes `ip:<addr>`; still rate- and image-limited by IP.
- `X-Forwarded-For` spoofing: trust only the value Railway's proxy appends (rightmost trusted hop), not arbitrary client-supplied entries.
- Concurrency on the global ceiling: read-then-increment can slightly overshoot; accepted (soft budget). If a hard cap is ever needed, switch to reserve-then-commit.
- Misconfig `SIGNEDIN_RESERVED_IMAGES > DAILY_IMAGE_LIMIT`: clamp reserved ≤ limit at load.
- Rate-limiter memory growth: prune IP entries older than the window on access (or a periodic sweep).
- `ANON_DAILY_CALL_LIMIT = 0`: anonymous blocked before any provider call (email-required mode).

## 8. Multi-perspective review notes

- UX: Frontend has a real dependency here — the shim/UI must handle three new responses: `401 sign_in_required` (open the auth sheet), `429` (gentle retry message), and the text-only `notice` codes (quiet, on-brand line — no exclamation/emoji/em-dash). This is small but must ship with the feature or the degraded states look like errors. Flag as a bundled frontend task.
- Technical: Single-instance assumption for the in-memory limiter is the one real landmine; pin Railway to one instance for launch. Atomic counter increments and correct `X-Forwarded-For` handling are the details to get right. No other hidden complexity.
- Executive: This is the cheapest change that makes launch safe — it proves the north-star (bounded daily spend) with one small table, one module, and a middleware. Nothing here is gold-plating.