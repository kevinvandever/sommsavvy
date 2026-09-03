# Implementation Plan

## Overview

Make Reverse Scan photo-first: when the user supplies a photo, that photo is the entry image and no portrait is generated; generation is kept only for no-photo (typed/spoken) scans. The change is contained to `reverseScanInternal`.

## Tasks

- [x] 1. Extract a pure image-decision helper
  - Add `decideEntryImage({ hasPhoto, allowed, confidence })` to `reverseScanInternal.ts` returning `'use_photo' | 'generate' | 'none'`: `use_photo` when `hasPhoto`; else `generate` when `allowed > 0 && confidence !== 'low'`; else `none`. Export for tests.
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.5_

- [x] 2. Rewire the portrait block to be photo-first
  - When a photo was supplied, set `result.photoUrl = imageUrl`, skip generation, skip the allowance check, and do not stream the "Pouring..." status or increment the image counter
  - Move the allowance check (`getCounters` / `computeImageAllowance`) and the `notice` assignment into the no-photo branch; keep generation, the status step, and `incrementImageCount` there exactly as today
  - Preserve the portrait-absent contract (full card already streamed before the branch)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.5_

- [x]* 3. Unit test the decision helper
  - hasPhoto -> use_photo (any allowance/confidence); no photo + allowed + not-low -> generate; no photo + allowance 0 -> none; no photo + low confidence -> none
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.5_

- [x] 4. Verify
  - Server typecheck + full suite; confirm the pairings path and enrichment are untouched and that a photo scan makes no generateImage call
  - _Requirements: 3.3, 3.4_

## Notes

- Frontend needs no change: the captured photo now arrives on `result.photoUrl`, and the existing `s.photoUrl || session.imageUrl` fallback in `Result.tsx` stays as a correct belt-and-suspenders.
- `smartScan`'s `forceMode: 'identify'` path inherits the fix automatically (it calls `reverseScanInternal`).
- Tasks marked `*` are optional tests.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3", "4"] }
  ]
}
```
