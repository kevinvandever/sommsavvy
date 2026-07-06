# Requirements — Cost Guardrails & Abuse Control

> Source spec authored by Pax (PM persona). Source of truth for *what* and *why*. Design covers *how*. Kiro generates tasks from these.

## 1. Problem & context

**The problem:** Pocket Somm and Reverse Scan are reachable without sign-in and generate AI images (~$0.04 each, 1–4 per call). On a public URL this is unbounded spend and an open abuse surface — and a single heavy user or bot can exhaust capacity and degrade the experience for everyone else.

**Who has it:** The operator bears the cost/abuse risk. All users bear the fairness risk — one actor starving the shared pool.

**Why now:** Imminent public launch for a contest. The app must be safe to expose, and the guardrails must ship *with* the backend, not get bolted on after it's already public.

## 2. Goals & success

**North-star metric:** Daily AI image spend stays within a predictable ceiling while the share of legitimate requests served (not hard-blocked) stays high — the app degrades to text-only rather than breaking.

**Secondary signals:** No single identity exceeds its daily image quota; signed-in users are never locked out by anonymous traffic; per-IP bursts are blocked.

**Non-goals:** Per-user billing/payments, a durable analytics pipeline, content moderation of uploaded images, distributed/multi-instance rate limiting, portrait caching.

## 3. Scope

| In v1 (ranked)                                               | Not now (deferred)                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| 1. Per-IP burst rate limit on AI endpoints                   | Distributed rate limiting (multi-instance) — *single instance for launch* |
| 2. Global daily image ceiling                                | Portrait caching by bottle identity — *separate roadmap item* |
| 3. Per-identity daily image quota (+ anon identity + IP backstop) | Content moderation of uploads — *out of scope*               |
| 4. Reserved image pool for signed-in users                   | Durable analytics sink — *log lines suffice for launch*      |
| 5. Pocket Somm image-count switch                            | Per-user billing / paid tiers — *roadmap: monetization*      |
| 6. Minimal launch instrumentation (5 events)                 |                                                              |

## 4. User stories & acceptance criteria

### Story 1 — Bound total daily image spend
**As the** operator, **I want** a global daily ceiling on image generation, **so that** total AI spend per day is bounded regardless of traffic.
- WHEN the global image count for the current UTC day is ≥ `DAILY_IMAGE_LIMIT` THEN the system SHALL NOT generate new images for any request AND SHALL return results as text-only.
- WHEN a new UTC day begins (00:00 UTC) THEN the global image count SHALL reset to zero.
- The global image count SHALL persist across server restarts and deploys.

### Story 2 — Fair share per user
**As a** user, **I want** each person limited to a fair share of daily images, **so that** one heavy user or bot cannot exhaust the pool and degrade everyone else.
- WHEN a signed-in user's image count for the current UTC day is ≥ `USER_DAILY_IMAGE_LIMIT` THEN the system SHALL skip image generation for that user and return text-only with a `daily_limit` notice.
- WHEN an anonymous identity's image count for the day is ≥ `ANON_DAILY_IMAGE_LIMIT` THEN the system SHALL skip image generation for that identity (text-only).
- WHEN images attributed to a single client IP exceed `ANON_IP_DAILY_IMAGE_LIMIT` in a day THEN the system SHALL skip image generation for that IP (backstop against device-token rotation).
- Per-identity and per-IP counts SHALL persist across restarts and reset at 00:00 UTC.

### Story 3 — Reserve capacity for signed-in users
**As the** operator, **I want** a slice of the global pool reserved for signed-in users, **so that** anonymous traffic can't lock out the users most likely to return or convert.
- WHEN granting an image to an anonymous caller would reduce global remaining below `SIGNEDIN_RESERVED_IMAGES` THEN the system SHALL skip image generation for anonymous callers (text-only) while continuing to serve signed-in callers up to `DAILY_IMAGE_LIMIT`.

### Story 4 — Burst / abuse protection
**As the** operator, **I want** a per-IP rate limit on the AI endpoints, **so that** a script can't drain budget or degrade service in seconds.
- WHEN requests from one client IP to an AI endpoint exceed `AI_RATE_PER_MIN` within a rolling 60-second window THEN the system SHALL respond HTTP 429 with a retry hint AND SHALL NOT invoke any AI provider.
- The client IP SHALL be derived from the forwarded header (`X-Forwarded-For`), since the app runs behind a proxy.

### Story 5 — Configurable launch mode
**As the** operator, **I want** anonymous access governed by config, **so that** I can choose anonymous-first, one-free-taste, or email-required without a code change.
- WHEN `ANON_DAILY_CALL_LIMIT` = 0 THEN any anonymous AI request SHALL be rejected with `sign_in_required` (HTTP 401) AND SHALL NOT invoke any provider.
- WHEN an anonymous identity has made `ANON_DAILY_CALL_LIMIT` AI calls in the current UTC day THEN further anonymous calls that day SHALL be rejected with `sign_in_required` (HTTP 401).
- WHEN `ANON_DAILY_CALL_LIMIT` is set high THEN anonymous users SHALL use the AI endpoints subject only to the image quotas (anonymous-first mode).

### Story 6 — Image-count switch
**As the** operator, **I want** to control how many portraits Pocket Somm generates, **so that** I can cut cost for launch and raise it later.
- WHEN `POCKET_SOMM_IMAGE_COUNT` = N THEN Pocket Somm SHALL generate at most N images per call (for the top N recommendations).
- Reverse Scan SHALL continue to generate at most one portrait per call.

### Story 7 — Don't penalize users for our failures
**As a** user, **I want** a failed image generation not to count against my quota, **so that** provider hiccups don't burn my allowance.
- WHEN an image generation attempt fails (provider error/timeout) THEN the system SHALL NOT increment the user, anonymous-identity, or global image counts for that failed image.
- Image counts SHALL increment only on successful generation.

### Story 8 — Graceful degradation
**As a** user who hits a limit, **I want** the app to still give me useful guidance, **so that** the experience degrades instead of breaking.
- WHEN any image limit (global, per-user, per-anon, reserved) is reached THEN the full textual recommendations / scan card SHALL still be returned.
- WHEN a limit notice is returned THEN it SHALL be machine-readable (a code/flag) so the UI can show an appropriate message (e.g. "today's portraits are used up — sign in for more").
- IF the rate limit (Story 4) or `sign_in_required` (Story 5) is hit THEN that request MAY be blocked outright (these are the only hard blocks; all image limits degrade to text).

### Story 9 — Launch instrumentation
**As the** operator, **I want** key funnel events logged, **so that** I can see during the contest whether the app works and where users drop.
- WHEN a recommendation/scan is requested THEN the system SHALL log `scan_started` with timestamp, method (`pocketSomm`/`reverseScan`), and identity type (user/anon).
- WHEN it completes THEN the system SHALL log `scan_succeeded`; IF it fails THEN `scan_failed` with a reason category.
- WHEN a cellar entry is saved THEN the system SHALL log `cellar_saved`.
- WHEN a new user is created on first verification THEN the system SHALL log `signed_up`.
- Events SHALL be structured log lines readable in Railway logs (no external analytics dependency in v1).

## 5. Constraints & assumptions

- **Stack:** Hono + Postgres backend. Durable counters live in Postgres (e.g. an `ai_usage` table keyed by identity + UTC day). The per-IP rate limiter MAY be in-memory.
- **Riskiest assumption:** the backend runs as a **single instance** for launch. The in-memory rate limiter is per-instance — if Railway scales beyond one instance, per-IP limiting weakens (the Postgres-backed image/identity counters remain correct). v1 pins to one instance and documents this.
- Anonymous identity (device token + IP) is **approximate and bypassable** (clear storage + rotate IP). Accepted for launch; the per-IP image backstop mitigates.
- Counting images **on success** creates a minor over-allowance under high concurrency. Accepted — this is a soft budget, not a hard transactional limit.
- **Out-of-scope dependency:** provider-side spend caps are set manually in the OpenAI / Anthropic / Google consoles; this feature does not enforce them.

## 6. Open questions

- [ ] None blocking. Default values are chosen (`DAILY_IMAGE_LIMIT=300`, `USER_DAILY_IMAGE_LIMIT=20`, `ANON_DAILY_IMAGE_LIMIT=5`, `ANON_IP_DAILY_IMAGE_LIMIT=15`, `SIGNEDIN_RESERVED_IMAGES=90`, `AI_RATE_PER_MIN=12`, `POCKET_SOMM_IMAGE_COUNT=1`); the launch-mode value of `ANON_DAILY_CALL_LIMIT` is set at deploy time per `launch-checklist.md` §2. Non-blocking.