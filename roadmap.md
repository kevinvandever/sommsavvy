# Roadmap — SommSavvy

> The cross-feature map individual specs don't have. Maintained by Pax: persistent across sessions, updated rather than regenerated. It's a map, not a contract — direction and order, not promised dates.

**North-star:** returning users who save to their cellar (the engaged-enthusiast signal — they came back *and* the cellar earned a bottle).

**Last updated:** 2026-06-24 · **Currently building:** Cost guardrails & abuse control

---

## Now
*Building, or the very next thing up.*

### Cost guardrails & abuse control — `building`
- **What:** Three-layer limit system — global daily image ceiling (wallet), per-user daily quota (fairness), per-IP burst limit (abuse) — plus a Pocket Somm image-count switch. Mode-agnostic so anonymous-first / one-free-taste / email-required is an env flip.
- **Depends on:** deployed backend (done).
- **Unblocks:** a safe public URL — without this, launch is an open tab on the AI bill.
- **Spec:** `docs/launch-checklist.md` → Cost Guardrails.

### Contest launch (Railway + Netlify + domain) — `next up`
- **What:** Deploy backend to Railway (Postgres, env, migrate-on-boot), frontend to Netlify, cross-wire CORS, point at the sommsavvy domain.
- **Depends on:** cost guardrails; Resend sending-domain verification (for email sign-in).
- **Unblocks:** real users, contest entry, first retention signal.
- **Spec:** `docs/deploy.md` + `docs/launch-checklist.md`.

---

## Next
*Committed and sequenced. Order here is a dependency order.*

### Observability & success instrumentation
- **What:** Log the funnel — scan started, scan succeeded, save, sign-up, error — and a north-star view.
- **Depends on:** launch.
- **Unblocks:** knowing what to build next instead of guessing.
- **Why it matters:** you cannot improve a funnel you cannot see.

### Account & data deletion + privacy page
- **What:** Let a user delete their account and cellar; a plain privacy statement covering email + cellar data.
- **Depends on:** launch (collecting emails publicly triggers the obligation).
- **Unblocks:** responsible scale; basic legal hygiene.

### First-run onboarding + moat visibility
- **What:** A guided first scan for cold users, and a way to show the taste profile working before a user has built a cellar.
- **Depends on:** launch learnings.
- **Unblocks:** higher activation; lets the differentiator show in a short trial.

### Portrait caching by bottle identity
- **What:** Generate a bottle portrait once per normalized identity (producer + name + vintage) and reuse across users.
- **Depends on:** cost guardrails.
- **Unblocks:** materially cheaper image cost → ability to raise image limits.

---

## Later
*Intended, not yet sequenced.*

- **Monetization — free tier + SommSavvy Pro** — usage-based: the per-user quota *is* the free tier; Pro unlocks volume + depth. Depends on: a real retention signal.
- **The Living Cellar lane** — drinking windows, vintage intelligence, cellar export/backup. Premium collector value; natural Pro features. (detail in `src/roadmap/`)
- **At the Table** — pairing planner (multi-course). Depends on: Pocket Somm maturity.
- **The Hunt** — hunt list, restaurant wine-list scanner. Depends on: Reverse Scan maturity.
- **Know Your Drink** — regional guides, tasting school.
- **Share cards / year-in-review** — lightweight, on-brand sharing.

---

## Someday / Won't
*Explicitly parked.*

- **Native iOS / Android apps** — *parked:* web/PWA proves the product first.
- **Social feed / community** — *parked:* the centered user is a private enthusiast, not a poster.
- **Numeric ratings / scores** — *won't:* deliberate stance. SommSavvy is positioned *against* rating culture.
- **Cocktail studio / home-bar planning** — *parked:* out of MVP scope.
- **Building for professional sommeliers** — *won't:* explicit non-target.

---

## Dependency view

deployed backend (done) └─ cost guardrails ──┬─ portrait caching (cheaper images) └─ contest launch ──┬─ observability ─→ everything downstream ├─ account/data deletion + privacy ├─ first-run + moat visibility ─→ activation └─ retention signal ─→ monetization ─→ Living Cellar (Pro) Resend domain ─→ email-gated sign-in (launch mode switch)