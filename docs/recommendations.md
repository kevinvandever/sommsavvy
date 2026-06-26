# SommSavvy — Recommendations & Tweaks

Captured during the MindStudio → Kiro migration, before deploying to Railway +
Netlify. Organized by urgency. Nothing here is a blocker for solo phone
testing; the "Pre-deploy" items matter once other people can reach the app.

---

## 1. Pre-deploy (decide or handle before a public-ish deploy)

### 1.1 Production secrets & flags (handled during deploy)
- `JWT_SECRET` must be a strong random value on Railway, not the local
  placeholder. Generate with:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- `AUTH_DEV_CODES` must be `false` in production (codes must go out by email,
  not the console).
- `CORS_ORIGINS` must be set to the exact Netlify URL — not left to reflect any
  origin.
- All API keys live in Railway/Netlify environment variables, never committed.
  (`.env` files are already gitignored.)

### 1.2 Cost & abuse control on the AI endpoints — FLAGGED RISK
`pocketSomm` and `reverseScan` are **unauthenticated** (anonymous use is a
product requirement) and **expensive** (Pocket Somm generates 3–4 images per
call). Once the app is on a public URL, that's an open door to run up image-gen
spend. For solo phone testing this is fine. Before sharing the URL:
- Add a basic per-IP rate limit on the AI routes (e.g. N calls/minute).
- Consider a hard daily ceiling on image generation as a cost circuit-breaker.
- Optionally gate image generation behind a lightweight anonymous token.

### 1.3 Email deliverability
Using Resend's `onboarding@resend.dev` sender only delivers to your own Resend
account address — perfect for solo testing, but no one else can sign in until a
domain is verified in Resend. Decide when to verify a sending domain.

---

## 2. Product validation backlog (post-launch — validate with real use)

These are deliberately NOT changes to make now. They are the questions to
answer by living with the app. Flag before specifying any of them.

### 2.1 Trust calibration on asserted facts
Reverse Scan states vintage, ABV, and value/price with editorial confidence.
For the discerning target user, a confident-but-wrong fact is a fast way to
lose trust. Consider:
- Treating verifiable facts (price, vintage, ABV) with more visible uncertainty
  than taste impressions.
- Using the existing `confidence` field more visibly in the UI when low.
- Deciding whether price claims belong in the MVP at all.

### 2.2 Are the generated bottle portraits load-bearing?
They are the signature visual AND the dominant variable cost AND invented (not
the real label). Cheap experiment: run with and without them for a couple of
weeks and see if the experience suffers. If they stay, consider a subtle "AI
impression" treatment so users don't read them as a real photo of the bottle.

### 2.3 Taste-profile cold start
The profile only activates after a few tasted entries (regen needs ≥3). A new
enthusiast with six bottles may not feel the personalization quickly. Watch how
fast the profile feels "alive" on a real cellar; consider leaning harder on the
optional `tasteSeed` during onboarding if the cold start feels flat.

### 2.4 Retention loop
The loop is reactive — the user must point the app at something. No proactive
hook is in the MVP (correctly; notifications are roadmap). Your own usage over
the next few weeks is the cheapest retention signal available. Note whether the
cellar-as-journal alone pulls you back.

---

## 3. Technical cleanup / tech debt (low risk, do when convenient)

### 3.1 Stale README — DONE
Root `README.md` now describes SommSavvy and the `server/` + `web/` structure.

### 3.2 Dead model-override names in method bodies — DONE
`pocketSomm.ts` / `reverseScan.ts` no longer pass legacy model ids; the AI
layer's override types now make `model` optional. Meaningful overrides
(temperature, max tokens, aspect ratio) are preserved.

### 3.3 Orphaned files in `server/.uploads/`
Leftover images from AI smoke tests sit alongside the 14 real imported photos.
Harmless, but worth a sweep. (Moot once images move to R2.)

### 3.4 Minimal observability
No error tracking/structured logging on the backend yet. For a deployed app,
even basic error logging (and a look at Railway logs) is worth setting up.

---

## 4. Migration loose ends

### 4.1 Retire the `dist/` reference folder — DONE
The original MindStudio export was deleted after the migration was verified and
data imported.

### 4.2 Importer → R2 (part of phase 9)
The MindStudio importer currently copies images to local disk. It will be
upgraded to upload through the storage layer so re-running against Railway
rehosts the 14 photos to R2, breaking the last dependency on the old
MindStudio CDN.

### 4.3 Demo seed vs. real data
The demo seed (Sloane/Theo/Ines) and real data both run through the same DB.
Local DB has been cleaned to just the real account. Decide whether the demo
seed should ever be loaded into production (probably not).
