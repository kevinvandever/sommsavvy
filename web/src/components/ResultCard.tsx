import { motion } from 'motion/react';
import { MonocleText } from './MonocleText';
import { SaveWithNote } from './SaveWithNote';
import { img } from '../lib/cdn';
import type { Recommendation } from '../types';
import { EASE, SPRING } from '../lib/motion';
import { IconGlassChampagne, IconBeer } from '@tabler/icons-react';

interface Props {
  rec: Recommendation;
  index: number;
  // onSave should return the saved entry's id so the "Add a note" link
  // can attach the note to it. void return is tolerated (auth-gated path).
  onSave: () => Promise<string | void>;
  saved?: boolean;
  // Id of the saved entry, once known. Lets the note link reappear after
  // navigation back to a previously-saved result.
  savedEntryId?: string;
  isFirst?: boolean; // for layoutId continuity from the scanned photo
}

const KIND_LABEL: Record<Recommendation['kind'], string> = {
  wine: 'Wine',
  beer: 'Beer',
  spirits: 'Spirits',
};

// A small icon glyph per kind. Keeps the editorial feel.
function KindGlyph({ kind, size = 16 }: { kind: Recommendation['kind']; size?: number }) {
  if (kind === 'beer') return <IconBeer size={size} stroke={1.4} />;
  // Use the wine-glass champagne for wine and spirits both at small size.
  return <IconGlassChampagne size={size} stroke={1.4} />;
}

export function ResultCard({ rec, index, onSave, saved, savedEntryId, isFirst }: Props) {
  // Build a one-line context string for the note sheet: "Producer · Region 2020"
  const contextLine = [rec.producer, rec.region, rec.vintage]
    .filter(Boolean)
    .join(' · ');
  const meta = [
    rec.producer,
    rec.region,
    rec.vintage,
    rec.abv && `${rec.abv}%`,
    rec.priceTier,
  ].filter(Boolean);

  return (
    <motion.article
      className="rcard"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        ...SPRING.sheet,
        delay: 0.12 + index * 0.09,
      }}
    >
      <div className="rcard__hero">
        {rec.photoUrl ? (
          isFirst ? (
            <motion.img
              layoutId="scanned-photo"
              src={img(rec.photoUrl, 800) || rec.photoUrl}
              alt={rec.name}
              className="rcard__photo"
            />
          ) : (
            <img src={img(rec.photoUrl, 800) || rec.photoUrl} alt={rec.name} className="rcard__photo" />
          )
        ) : (
          <div className="rcard__photo-skel" aria-hidden="true">
            <span className="t-mono rcard__rendering">Rendering ●</span>
          </div>
        )}
      </div>

      <div className="rcard__body">
        <p className="t-label rcard__eyebrow">
          <KindGlyph kind={rec.kind} /> {KIND_LABEL[rec.kind]}
        </p>
        <h3 className="t-display rcard__title">{rec.name}</h3>

        {meta.length > 0 && (
          <p className="t-caption rcard__meta tnum">
            {meta.map((m, i) => (
              <span key={i}>
                {i > 0 && <span className="rcard__dot"> · </span>}
                {m}
              </span>
            ))}
          </p>
        )}

        <MonocleText text={rec.why} aside={rec.monocleAside} />

        {rec.pairings && rec.pairings.length > 0 && (
          <>
            <div className="divider" />
            <p className="t-label rcard__pair-label">Pairs with</p>
            <div className="rcard__pairings">
              {rec.pairings.map((p, i) => (
                <span key={i} className="chip">
                  {p}
                </span>
              ))}
            </div>
          </>
        )}

        <div className="rcard__cta">
          <SaveWithNote
            onSave={onSave}
            saved={!!saved}
            savedEntryId={savedEntryId}
            drinkName={rec.name}
            contextLine={contextLine || undefined}
          />
        </div>
      </div>

      <style>{`
        .rcard {
          background: var(--smoke);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          box-shadow: var(--lift-2);
          display: flex;
          flex-direction: column;
        }
        .rcard__hero {
          position: relative;
          aspect-ratio: 4 / 5;
          background: var(--midnight);
          overflow: hidden;
        }
        .rcard__photo {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .rcard__hero::after {
          content: '';
          position: absolute; inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg in oklch,
            transparent 0%, transparent 60%,
            color-mix(in oklch, var(--smoke) 30%, transparent) 78%,
            color-mix(in oklch, var(--smoke) 70%, transparent) 90%,
            var(--smoke) 100%);
        }
        .rcard__photo-skel {
          width: 100%; height: 100%;
          background:
            radial-gradient(ellipse 120% 80% at 50% 60%,
              color-mix(in oklch, var(--ember) 8%, transparent) 0%, transparent 70%),
            repeating-linear-gradient(45deg,
              color-mix(in oklch, var(--bone) 4%, transparent) 0px,
              color-mix(in oklch, var(--bone) 4%, transparent) 1px,
              transparent 1px, transparent 12px);
          animation: rcard-skel-pulse 2.4s ease-in-out infinite;
          position: relative;
        }
        @keyframes rcard-skel-pulse {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        .rcard__rendering {
          position: absolute;
          bottom: 16px; left: 16px;
          color: color-mix(in oklch, var(--bone) 50%, transparent);
        }
        .rcard__body {
          padding: 28px;
        }
        @media (min-width: 760px) {
          .rcard__body { padding: 40px 48px; }
        }
        .rcard__eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          margin-bottom: 12px;
        }
        .rcard__title {
          margin-bottom: 8px;
        }
        .rcard__meta {
          margin-bottom: 16px;
        }
        .rcard__dot {
          color: color-mix(in oklch, var(--bone) 45%, transparent);
        }
        .rcard__pair-label { margin-bottom: 10px; }
        .rcard__pairings {
          display: flex; flex-wrap: wrap; gap: 8px;
          margin-bottom: 28px;
        }
        .rcard__cta {
          display: flex; justify-content: flex-start;
        }
      `}</style>
    </motion.article>
  );
}
