# Design Document

## Overview

The change lives almost entirely in `reverseScanInternal`. Today, after identification, it always attempts portrait generation (gated by allowance and confidence) and sets `result.photoUrl` to the generated image. We flip the default: when the caller passed a photo (`imageUrl`), that becomes `result.photoUrl` and generation is skipped; generation only runs when there is no photo.

Because the frontend save already falls back to the user's photo, and will now receive it directly on `result.photoUrl`, no frontend change is strictly required. A one-line simplification on the frontend is included for clarity but is optional.

## The single behavioral change

In `reverseScanInternal`, the identification result is produced from either a photo or text. The portrait block currently runs whenever `allowed > 0 && confidence !== 'low'`. The new logic:

```
if (imageUrl) {
  // Photo scan: the user's own photo is the entry image. No generation,
  // no allowance consumption, no status step.
  result.photoUrl = imageUrl;
} else if (allowed > 0 && result.confidence !== 'low') {
  // No-photo scan (typed/spoken): keep generating a portrait exactly as before.
  await defaultStream({ status: 'Pouring...' });
  ...generateImage... result.photoUrl = portrait; incrementImageCount(...);
}
```

Key points:
- The **image allowance check** (`getCounters` / `computeImageAllowance`) moves inside the no-photo branch, since a photo scan neither needs nor consumes allowance (Requirement 1.3). The `notice` it can set (`images_unavailable`) is only meaningful when we intend to generate, so it is only computed on the no-photo path.
- The **"Pouring..." status** is only streamed on the no-photo path, so photo scans lose that step (Requirement 3.1).
- The **portrait-absent contract is preserved** for no-photo scans: the full text card is still streamed before the branch, so a skipped or failed generation still returns a complete, saveable card (Requirement 2.2).
- **Low confidence with a photo** still uses the photo (Requirement 3.5): the `confidence !== 'low'` gate only guards generation, and generation no longer runs when a photo exists.

## `forceMode: 'identify'` override path

`smartScan` has a `forceMode === 'identify'` branch that calls `reverseScanInternal` directly. Since the fix is inside `reverseScanInternal`, the override inherits it automatically: an override on a photo scan will use the photo, an override on a text scan will still generate. No separate change needed.

## Frontend (optional simplification)

`Result.tsx` `buildScanPayload` currently does:

```ts
photoUrl: s.photoUrl || session?.imageUrl || undefined,
```

With the backend now putting the captured photo on `s.photoUrl` for photo scans, the `session?.imageUrl` fallback becomes redundant for the common case but is harmless and still correct for any edge case where the result lacks a photoUrl but a session image exists. Leave it as-is; it is a correct belt-and-suspenders fallback. No change required.

## Data Models

Unchanged. `photoUrl` already holds a URL string; whether that URL points at the user's uploaded photo or a generated image is transparent to the schema and the save path (Requirement 3.3).

## Cost and latency impact

- Photo scans (the common case) stop calling `generateImage`, removing the single largest per-scan cost and one provider round-trip. This is a pure reduction; the existing guardrails still cap the remaining text/voice generations.
- Text/voice scans are unchanged in cost and behavior.

## Testing Strategy

The portrait decision is currently inline in a long function. To test it directly, extract a small pure helper that answers "given (hasPhoto, allowed, confidence), what is the image decision?" and returns one of `use_photo | generate | none`. Then:

- **hasPhoto = true** -> `use_photo`, regardless of allowance or confidence (Requirements 1.1, 1.2, 3.5).
- **hasPhoto = false, allowed > 0, confidence != low** -> `generate` (Requirement 2.1).
- **hasPhoto = false, allowed = 0** -> `none` (Requirement 2.2).
- **hasPhoto = false, confidence = low** -> `none` (Requirement 2.2).

Unit-test that helper. The surrounding streaming/generation wiring stays as-is and is covered by the existing scan tests. All AI/db calls remain stubbed; no live network.

## What this deliberately does not change

- The pairings path and its own image handling.
- The web-enrichment step.
- The save input contract or the data model.
- The image guardrails themselves (only which scans reach them).
