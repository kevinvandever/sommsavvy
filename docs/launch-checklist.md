# Contest Launch Checklist — SommSavvy

Everything to take SommSavvy from "works on my machine" to "safe on a public URL
for the contest." The cost guardrails are specced inline (Kiro-ready) so they
live with the rest of the launch plan.

---

## 1. Success — define it before you ship

**North-star for the contest:** completed scans (a visitor pointed at something
and got a result) + sign-ups.
**Secondary:** saves to cellar, return visits.
**Call-it-a-win target (set your own):** e.g. 100 completed scans, 25 sign-ups.

Without this you finish the day unable to say whether it worked. See §5 for the
minimum instrumentation.

---

## 2. Auth mode for launch (one env decision)

Pick how anonymous callers are treated — code is mode-agnostic, so this is just
env values:

| Mode                           | `ANON_DAILY_CALL_LIMIT` | When to use                                        |
| ------------------------------ | ----------------------- | -------------------------------------------------- |
| Anonymous-first (safe default) | high (e.g. 50)          | Resend domain NOT verified in time                 |
| One free taste, then gate      | 1                       | Domain verified; preserve the wow + capture email  |
| Email-required                 | 0                       | Domain verified; judged/demo contest, lead capture |

**Hard dependency:** any gated mode requires a verified Resend sending domain,
or no one but you can receive a sign-in code. If the domain isn't verified by
launch, ship anonymous-first.

---

## 3. Cost guardrails (Kiro-ready spec)

### Problem
`pocketSomm` and `reverseScan` are reachable without auth and generate images
(~$0.04 each), so a public URL is an unbounded spend + abuse surface. One heavy
user/bot can also starve everyone else.

### Design — three independent limits + an image-count switch
- **Global daily ceiling** — protects total spend.
- **Per-identity daily quota** — fairness; one user can't drain the pool.
  Identity = `user:<id>` (signed-in) or `anon:<token>` (anonymous), with a
  per-IP daily cap as a backstop against token rotation.
- **Per-IP burst limit** — anti-abuse against scripts (in-memory; see landmine).
- **Image-count switch** — how many portraits Pocket Somm makes per call.

### Config (env, tunable live)

DAILY_IMAGE_LIMIT=300 # global wallet ceiling SIGNEDIN_RESERVED_IMAGES=90 # slice of global reserved for signed-in users USER_DAILY_IMAGE_LIMIT=20 # signed-in fairness ANON_DAILY_CALL_LIMIT=50 # total AI calls/day for an anon identity (mode switch) ANON_DAILY_IMAGE_LIMIT=5 # images/day for an anon identity ANON_IP_DAILY_IMAGE_LIMIT=15 # backstop vs anon-token rotation AI_RATE_PER_MIN=12 # per-IP burst POCKET_SOMM_IMAGE_COUNT=1 # portraits per Pocket Somm call

\### Behavior — degrade, don't break (text is cheap, images are the cost)- Over per-IP burst → block the call.- Over per-identity image quota / global ceiling / reserved-pool rule → still  return full text recommendations, just no new portrait, with a notice.- In gated modes, anon over call limit → require sign-in. ### Acceptance criteria- WHEN requests from one IP exceed `AI_RATE_PER_MIN` in a rolling minute THEN  the system SHALL respond 429 with a retry hint AND SHALL NOT call any AI provider.- WHEN an anonymous caller has used `ANON_DAILY_CALL_LIMIT` calls today THEN the  system SHALL respond with `sign_in_required` (HTTP 401) AND SHALL NOT call any provider.- WHEN the global image count for the current UTC day ≥ `DAILY_IMAGE_LIMIT` THEN  the system SHALL return recommendations as text-only AND flag images as unavailable.- WHEN a signed-in user's image count today ≥ `USER_DAILY_IMAGE_LIMIT` THEN the  system SHALL skip image generation for that request and return text-only with a `daily_limit` notice.- WHEN an anonymous identity's image count today ≥ `ANON_DAILY_IMAGE_LIMIT`  (or its IP ≥ `ANON_IP_DAILY_IMAGE_LIMIT`) THEN the system SHALL skip image generation, text-only.- WHEN anonymous (non-reserved) image use would consume the `SIGNEDIN_RESERVED_IMAGES`  slice of the global pool THEN the system SHALL skip images for anonymous callers while still serving signed-in callers.- WHEN `POCKET_SOMM_IMAGE_COUNT=N` THEN Pocket Somm SHALL generate at most N images per call.- Daily counters SHALL reset at 00:00 UTC AND SHALL be stored durably (survive restarts). ### Provider-console backstops (set by hand, not code)- OpenAI: hard monthly limit ~$25 (transcription only).- Anthropic: monthly spend limit ~$75.- Google: budget alert ~$200–300/mo **and** a low RPM quota on the Generative  Language API (Google budgets are alerts, not hard stops — the app ceiling is the real bound). --- ## 4. Definition of done (the bar to call it launched)- [ ] Backend on Railway, healthy, migrate-on-boot ran (logs show `Storage: Cloudflare R2`).- [ ] Frontend on Netlify, pointing at the Railway URL.- [ ] `CORS_ORIGINS` locked to the Netlify origin; `AUTH_DEV_CODES=false`.- [ ] Cost guardrails deployed and verified (trip the per-IP limit once to confirm).- [ ] Auth mode chosen + env set (§2).- [ ] Phone smoke test: full Pocket Somm + Reverse Scan + (sign-in if gated) on a real phone.- [ ] Graceful failure verified: provider error → friendly message, not a stack trace.- [ ] Privacy note live + a delete-on-request path (§6).- [ ] `scan_started` / `scan_succeeded` / `scan_failed` events logging where you can read them (§5). --- ## 5. Observability (minimum viable)Log these five events with a timestamp and identity (or anon token):`scan_started`, `scan_succeeded`, `scan_failed`, `cellar_saved`, `signed_up`.For tomorrow, structured `console.log` lines you can grep in Railway logs areenough; a real analytics sink is a Next-horizon item. Target: see the funnelfrom arrival → completed scan → save → sign-up. --- ## 6. Privacy & data deletion (minimum)- A one-paragraph privacy note: what you store (email, cellar entries, uploaded  images), that you don't sell it, and how to get it deleted.- A delete path: even manual ("email hello@sommsavvy.com to delete your account")  is acceptable for the contest, but it must exist and be honored.- Decide retention for uploaded images in R2 (they're user content in your bucket). --- ## 7. First-run & moat visibility (decision needed)The taste profile — the differentiator — is invisible to a cold visitor with anempty cellar, so the contest rides on the immediacy of Pocket Somm / Reverse Scan.Decide one:- (a) Lean the pitch entirely on the two instant pillars (lowest effort), or- (b) Give judges a populated demo cellar to browse so the profile shows.Either way, make the first-run state obvious: a cold user must understand in~5 seconds what to point at. --- ## 8. Failure & degradation paths- AI provider down / 429 → user-facing "the somm is taking a moment, try again,"  never a stack trace. (Methods already try/catch + retry once; confirm the copy.)- Email code in spam / delayed → working "resend code" + clear expiry message;  this is the top drop-off risk in gated modes.- Railway cold start / single instance → keep to one instance for launch (the  per-IP limiter is in-memory; multi-instance would halve it). Confirm Postgres  backups are enabled — that DB is now the only home for user data. --- ## 9. Run-of-show for tomorrow (in order)1. Register domain → add to Resend → add DNS records → wait for "Verified."2. Build the cost guardrails (§3); typecheck; commit; push.3. Railway: project from repo, root dir `server`, add Postgres, set env (`docs/deploy.md`), deploy.4. Import your data into the Railway DB (`docs/deploy.md` §2).5. Netlify: site from repo (uses `netlify.toml`), set `VITE_API_BASE_URL` to the Railway URL, deploy.6. Cross-wire: set `CORS_ORIGINS` + `PUBLIC_BASE_URL` on Railway, set auth-mode env (§2), redeploy.7. Provider-console spend caps (§3).8. Phone smoke test against the definition of done (§4).9. Submit to the contest.

