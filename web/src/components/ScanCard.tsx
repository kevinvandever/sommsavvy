import { motion } from 'motion/react';
import { MonocleText } from './MonocleText';
import { SaveWithNote } from './SaveWithNote';
import { img } from '../lib/cdn';
import type { ScanResult } from '../types';
import { SPRING } from '../lib/motion';

interface Props {
  result: ScanResult;
  capturedDataUrl: string | null;
  // onSave should return the saved entry's id so the "Add a note" link
  // can attach the note to it. void return is tolerated (auth-gated path).
  onSave: () => Promise<string | void>;
  saved?: boolean;
  savedEntryId?: string;
}

// The Reverse Scan card. Single editorial spread.
export function ScanCard({ result, capturedDataUrl, onSave, saved, savedEntryId }: Props) {
  const meta = [
    result.vintage,
    result.abv && `${result.abv}%`,
    result.region,
  ].filter(Boolean);
  const contextLine = [result.producer, result.region, result.vintage]
    .filter(Boolean)
    .join(' · ');

  // Prefer the AI-generated chiaroscuro portrait; fall back to the user's
  // captured photo if portrait wasn't generated (low confidence path).
  const heroSrc = result.photoUrl ? img(result.photoUrl, 1000) || result.photoUrl : capturedDataUrl;

  return (
    <motion.article
      className="scard"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={SPRING.sheet}
    >
      <div className="scard__hero">
        {heroSrc && (
          <motion.img
            layoutId="scanned-photo"
            src={heroSrc}
            alt={result.name}
            className="scard__photo"
          />
        )}
      </div>

      <div className="scard__body">
        {result.producer && <p className="t-label scard__eyebrow">{result.producer}</p>}
        <h2 className="t-display scard__title">{result.name}</h2>

        {meta.length > 0 && (
          <p className="t-mono scard__meta tnum">
            {meta.map((m, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {m}
              </span>
            ))}
          </p>
        )}

        {result.confidence === 'low' && (
          <div className="scard__low-confidence">
            <p className="t-aside">Could not place this one with certainty.</p>
            <p className="t-caption">{result.expect}</p>
          </div>
        )}

        {result.confidence !== 'low' && (
          <>
            <p className="t-label scard__sec">What to expect</p>
            <MonocleText text={result.expect} aside={result.monocleAside} className="t-why" />

            <div className="divider" />

            {result.pairings && result.pairings.length > 0 && (
              <>
                <p className="t-label scard__sec">Pairings</p>
                <div className="scard__pairings">
                  {result.pairings.map((p, i) => (
                    <span key={i} className="chip">
                      {p}
                    </span>
                  ))}
                </div>
              </>
            )}

            {result.valueNote && (
              <>
                <p className="t-label scard__sec">Value</p>
                <p className="t-body scard__inline">{result.valueNote}</p>
              </>
            )}

            {result.occasion && (
              <>
                <p className="t-label scard__sec">Occasion</p>
                <p className="t-body scard__inline">{result.occasion}</p>
              </>
            )}
          </>
        )}

        <div className="scard__cta">
          <SaveWithNote
            onSave={onSave}
            saved={!!saved}
            savedEntryId={savedEntryId}
            drinkName={result.name}
            contextLine={contextLine || undefined}
          />
        </div>
      </div>

      <style>{`
        .scard {
          background: var(--smoke);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          box-shadow: var(--lift-2);
        }
        .scard__hero {
          position: relative;
          aspect-ratio: 4 / 5;
          background: var(--midnight);
          overflow: hidden;
        }
        .scard__photo {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .scard__hero::after {
          content: '';
          position: absolute; inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg in oklch,
            transparent 0%, transparent 55%,
            color-mix(in oklch, var(--smoke) 40%, transparent) 80%,
            var(--smoke) 100%);
        }
        .scard__body {
          padding: 28px;
        }
        @media (min-width: 760px) {
          .scard__body { padding: 40px 48px; }
        }
        .scard__eyebrow { margin-bottom: 8px; }
        .scard__title { margin-bottom: 12px; }
        .scard__meta { margin-bottom: 24px; }
        .scard__sec { margin-top: 20px; margin-bottom: 10px; }
        .scard__sec:first-of-type { margin-top: 0; }
        .scard__inline { margin-bottom: 4px; }
        .scard__pairings {
          display: flex; flex-wrap: wrap; gap: 8px;
          margin-bottom: 8px;
        }
        .scard__cta {
          margin-top: 32px;
        }
        .scard__low-confidence {
          padding: 20px;
          background: color-mix(in oklch, var(--smoke) 50%, var(--midnight));
          border-radius: var(--radius-md);
          margin-bottom: 24px;
        }
      `}</style>
    </motion.article>
  );
}
