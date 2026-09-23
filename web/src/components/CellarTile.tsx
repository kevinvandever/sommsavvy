import { useLocation } from 'wouter';
import { IconBottle } from '@tabler/icons-react';
import { img } from '../lib/cdn';
import { monogramFor } from '../lib/monogram';
import type { CellarEntry } from '../types';
import { motion } from 'motion/react';
import { EASE, DUR } from '../lib/motion';

interface Props {
  entry: CellarEntry;
  featured?: boolean;
  // Suppress the owned dot when the "In the Rack" filter is active — every
  // tile would be dotted, which is noise. The filter context already says
  // these are all owned.
  hideOwnedDot?: boolean;
  // When a natural-language search surfaced this tile, a short reason it fit
  // the query. Shown as a quiet caption in the tile body.
  reason?: string;
  // Show an availability tag (in your rack / not on hand) during a whole-cellar
  // search, so the user knows what they can open now versus grab elsewhere.
  showAvailability?: boolean;
}

// Entries without a photo (bulk-imported bottles, hand-typed ones) get a
// designed placeholder rather than a stock photo of some other bottle: a
// kind-tinted field with the bottle's initial. Tinting by kind means a rack of
// imported wine, beer, and spirits reads as varied and deliberate instead of
// four repeats of the same coupe. No external asset, so nothing to 404.

// A single cellar tile in the asymmetric mosaic.
export function CellarTile({ entry, featured, hideOwnedDot, reason, showAvailability }: Props) {
  const [, navigate] = useLocation();
  const isNew = Date.now() - entry.savedAt < 7 * 24 * 60 * 60 * 1000;
  const usingPlaceholder = !entry.photoUrl;
  const monogram = monogramFor(entry);
  // The availability tag (search mode) already states ownership, so the photo
  // dot would be redundant there; show the dot only outside that case.
  const showOwnedDot = entry.owned === true && !hideOwnedDot && !showAvailability;

  return (
    <motion.article
      layout
      className={`tile ${featured ? 'tile--featured' : ''}`}
      onClick={() => navigate(`/cellar/${entry.id}`)}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: DUR.std, ease: EASE.entrance }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/cellar/${entry.id}`);
        }
      }}
    >
      <div className="tile__photo-wrap">
        {usingPlaceholder ? (
          <div className={`tile__stand-in tile__stand-in--${entry.kind}`} aria-hidden="true">
            {monogram ? (
              <span className="tile__stand-in-letter">{monogram}</span>
            ) : (
              <IconBottle size={featured ? 64 : 48} stroke={1.2} className="tile__stand-in-glyph" />
            )}
          </div>
        ) : (
          <img
            src={img(entry.photoUrl!, featured ? 800 : 480) || entry.photoUrl}
            alt={entry.name}
            className="tile__photo"
            loading="lazy"
          />
        )}

        {isNew && (
          <span className="t-label tile__new">NEW</span>
        )}

        {/* Owned marker: a quiet Bone dot, top-right. No glow — ownership is
            a stated fact, not an achievement. The dark halo keeps it legible
            over the unpredictable highlights of chiaroscuro photography. */}
        {showOwnedDot && (
          <span
            className={`tile__owned ${featured ? 'tile__owned--lg' : ''}`}
            title="In the rack"
            aria-label="In the rack"
          />
        )}
      </div>

      <div className="tile__body">
        <p className="t-label tile__kind">{entry.kind}</p>
        <h3 className={featured ? 't-headline' : 'tile__name'}>{entry.name}</h3>
        {(entry.producer || entry.vintage) && (
          <p className="t-caption tile__meta tnum">
            {[entry.producer, entry.vintage].filter(Boolean).join(' · ')}
          </p>
        )}
        {reason && <p className="tile__reason">{reason}</p>}
        {showAvailability && (
          <p className={`tile__avail ${entry.owned === true ? 'is-owned' : 'is-away'}`}>
            {entry.owned === true ? 'In your rack' : "You'll need a bottle"}
          </p>
        )}
      </div>

      <style>{`
        .tile {
          position: relative;
          background: var(--smoke);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          overflow: hidden;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          transition:
            transform 280ms var(--ease-standard),
            border-color 280ms var(--ease-standard),
            box-shadow 280ms var(--ease-standard);
        }
        .tile:hover {
          transform: translateY(-2px);
          border-color: color-mix(in oklch, var(--ember) 25%, var(--border-subtle));
          box-shadow:
            0 12px 32px color-mix(in oklch, var(--ember) 18%, transparent),
            0 1px 0 0 color-mix(in oklch, var(--bone) 8%, transparent) inset;
        }
        .tile__photo-wrap {
          position: relative;
          aspect-ratio: 4 / 5;
          background: var(--midnight);
          overflow: hidden;
        }
        .tile__photo {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 600ms var(--ease-standard), filter 600ms var(--ease-standard);
          filter: saturate(0.95) brightness(0.95);
        }
        .tile:hover .tile__photo {
          transform: scale(1.04);
          filter: saturate(1.05) brightness(1);
        }
        /* Designed stand-in for entries with no photo. Tinted by kind so a
           mixed rack reads as varied rather than repeating one stock image. */
        .tile__stand-in {
          position: absolute; inset: 0;
          display: grid; place-items: center;
          transition: filter 600ms var(--ease-standard);
        }
        .tile:hover .tile__stand-in { filter: brightness(1.12); }
        .tile__stand-in--wine {
          background:
            radial-gradient(ellipse 70% 60% at 50% 30%, color-mix(in oklch, var(--bordeaux) 42%, transparent) 0%, transparent 70%),
            linear-gradient(160deg in oklch, color-mix(in oklch, var(--bordeaux) 22%, var(--midnight)) 0%, var(--midnight) 100%);
        }
        .tile__stand-in--beer {
          background:
            radial-gradient(ellipse 70% 60% at 50% 30%, color-mix(in oklch, var(--ember) 38%, transparent) 0%, transparent 70%),
            linear-gradient(160deg in oklch, color-mix(in oklch, var(--ember) 18%, var(--midnight)) 0%, var(--midnight) 100%);
        }
        .tile__stand-in--spirits {
          background:
            radial-gradient(ellipse 70% 60% at 50% 30%, color-mix(in oklch, var(--bone) 22%, transparent) 0%, transparent 70%),
            linear-gradient(160deg in oklch, color-mix(in oklch, var(--bone) 10%, var(--midnight)) 0%, var(--midnight) 100%);
        }
        .tile__stand-in-glyph {
          color: color-mix(in oklch, var(--bone) 40%, transparent);
        }
        .tile__stand-in-letter {
          font-family: var(--font-rowan);
          font-style: italic;
          font-weight: 400;
          font-size: clamp(56px, 18vw, 96px);
          color: color-mix(in oklch, var(--bone) 62%, transparent);
          text-shadow: 0 4px 16px color-mix(in oklch, var(--midnight) 60%, transparent);
          line-height: 1;
        }
        .tile__new {
          position: absolute;
          top: 12px; left: 12px;
          color: var(--ember);
          font-size: 10px;
          letter-spacing: 0.12em;
        }
        .tile__owned {
          position: absolute;
          top: 12px; right: 12px;
          width: 7px; height: 7px;
          border-radius: var(--radius-pill);
          background: var(--owned);
          /* Dark halo, not a glow — guarantees legibility on lit highlights. */
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--midnight) 55%, transparent);
        }
        .tile__owned--lg {
          width: 8px; height: 8px;
        }
        .tile__body {
          padding: 14px 14px 16px;
        }
        .tile--featured {
          grid-column: span 2;
        }
        .tile--featured .tile__body {
          padding: 18px 20px 20px;
        }
        .tile__kind {
          font-size: 10px;
          margin-bottom: 4px;
        }
        .tile__name {
          font: 500 16px/1.25 var(--font-rowan);
          color: var(--parchment);
          letter-spacing: -0.01em;
        }
        .tile__meta {
          margin-top: 4px;
        }
        .tile__reason {
          margin-top: 8px;
          font: italic 13px/1.35 var(--font-rowan);
          color: color-mix(in oklch, var(--ember) 70%, var(--bone));
        }
        .tile__avail {
          margin-top: 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font: 500 10px var(--font-geist);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .tile__avail::before {
          content: '';
          width: 6px; height: 6px;
          border-radius: var(--radius-pill);
          background: currentColor;
        }
        .tile__avail.is-owned {
          color: var(--owned);
        }
        .tile__avail.is-away {
          color: color-mix(in oklch, var(--bone) 50%, transparent);
        }
      `}</style>
    </motion.article>
  );
}
