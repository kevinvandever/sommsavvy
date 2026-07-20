import { AnimatePresence } from 'motion/react';
import { CellarTile } from './CellarTile';
import type { CellarEntry } from '../types';

interface Props {
  entries: CellarEntry[];
  // When the "In the Rack" filter is active, every tile is owned, so the
  // per-tile owned dot is suppressed (it would be noise).
  hideOwnedDots?: boolean;
  // When a natural-language search is active, a short reason per entry
  // explaining why it fit the query, keyed by entry id.
  reasons?: Record<string, string>;
  // Show a per-tile availability tag (in your rack / not on hand). Used during
  // an "All" or kind-filtered search so the user can see what they can open
  // now versus what they would need to grab. Suppressed in rack-only search
  // where every result is owned.
  showAvailability?: boolean;
}

// Asymmetric mosaic. We feature *judiciously* — too many wide tiles makes
// the grid feel chaotic. Logic: a featured tile is a 5-star entry that's
// also recent, OR every-Nth entry to give the eye a rhythm. Caps at ~25%
// featured so most of the grid stays standard.
export function CellarMosaic({ entries, hideOwnedDots, reasons, showAvailability }: Props) {
  const week = 7 * 24 * 60 * 60 * 1000;

  // Pick the featured set up front so the visual rhythm is intentional.
  // Without numeric ratings, "standout" is now derived from recency alone —
  // anything saved in the last week is fresh enough to deserve the larger
  // tile slot, capped at ~1 in 5 entries so the mosaic stays rhythmic.
  const featuredIds = new Set<string>();
  let featuredCount = 0;
  const cap = Math.max(1, Math.floor(entries.length / 5));
  entries.forEach((e) => {
    const isRecent = Date.now() - e.savedAt < week;
    if (isRecent && featuredCount < cap) {
      featuredIds.add(e.id);
      featuredCount++;
    }
  });

  return (
    <div className="mosaic">
      <AnimatePresence mode="popLayout">
        {entries.map((entry) => (
          <CellarTile
            key={entry.id}
            entry={entry}
            featured={featuredIds.has(entry.id)}
            hideOwnedDot={hideOwnedDots}
            reason={reasons?.[entry.id]}
            showAvailability={showAvailability}
          />
        ))}
      </AnimatePresence>
      <style>{`
        .mosaic {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          grid-auto-flow: dense;
        }
        @media (min-width: 600px) {
          .mosaic {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
        }
        @media (min-width: 900px) {
          .mosaic {
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
          }
        }
        @media (min-width: 1200px) {
          .mosaic {
            grid-template-columns: repeat(6, 1fr);
            gap: 24px;
          }
        }
      `}</style>
    </div>
  );
}
