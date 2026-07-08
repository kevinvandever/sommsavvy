import { useState } from 'react';
import { motion } from 'motion/react';
import { MonocleText } from './MonocleText';
import { SaveWithNote } from './SaveWithNote';
import { img } from '../lib/cdn';
import type { Kind, ScanResult } from '../types';
import { SPRING } from '../lib/motion';

const KINDS: Kind[] = ['wine', 'beer', 'spirits'];
const CURRENT_YEAR = new Date().getFullYear();

export interface EditedIdentity {
  name: string;
  producer: string;
  region: string;
  vintage: number | null;
  kind: Kind;
}

export interface ScanCardErrors {
  name?: string;
  vintage?: string;
  kind?: string;
}

/** Validate identity fields before save. Returns an errors object (empty = valid). */
export function validateIdentity(fields: EditedIdentity): ScanCardErrors {
  const errors: ScanCardErrors = {};

  if (!fields.name.trim()) {
    errors.name = 'A name is needed to save this one.';
  }

  if (fields.vintage != null) {
    if (fields.vintage < 1900 || fields.vintage > CURRENT_YEAR + 1) {
      errors.vintage = 'That vintage seems off.';
    }
  }

  if (!KINDS.includes(fields.kind)) {
    errors.kind = 'Pick a type: wine, beer, or spirits.';
  }

  return errors;
}

interface Props {
  result: ScanResult;
  capturedDataUrl: string | null;
  // onSave receives the edited identity fields and should return the saved
  // entry's id so the "Add a note" link can attach the note to it. void
  // return is tolerated (auth-gated path).
  onSave: (edited: EditedIdentity) => Promise<string | void>;
  saved?: boolean;
  savedEntryId?: string;
}

// The Reverse Scan card. Single editorial spread with inline-editable
// identity fields (name, producer, region, vintage, kind). Edits are held
// in local state and never mutate the store result until save.
export function ScanCard({ result, capturedDataUrl, onSave, saved, savedEntryId }: Props) {
  // --- Local editable state, initialized from result ---
  const [name, setName] = useState(result.name || '');
  const [producer, setProducer] = useState(result.producer || '');
  const [region, setRegion] = useState(result.region || '');
  const [vintage, setVintage] = useState<number | null>(result.vintage ?? null);
  const [kind, setKind] = useState<Kind>(result.kind || 'wine');

  // Raw vintage string for the input so we can allow empty and partial typing
  const [vintageRaw, setVintageRaw] = useState<string>(
    result.vintage != null ? String(result.vintage) : '',
  );

  // --- Field-level validation errors ---
  const [errors, setErrors] = useState<ScanCardErrors>({});

  // --- Low-confidence "settled" gate ---
  // When confidence is low, the save action is unsettled until the user
  // either edits at least one identity field or explicitly confirms.
  // When confidence is not low, settled is always true.
  const isLowConfidence = result.confidence === 'low';
  const [userEdited, setUserEdited] = useState(false);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const settled = !isLowConfidence || userEdited || userConfirmed;

  // Wrap setters to track edits for the settled gate and clear field errors
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value.slice(0, 200));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
    if (isLowConfidence) setUserEdited(true);
  };
  const handleProducerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProducer(e.target.value.slice(0, 200));
    if (isLowConfidence) setUserEdited(true);
  };
  const handleRegionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegion(e.target.value.slice(0, 200));
    if (isLowConfidence) setUserEdited(true);
  };
  const handleVintageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setVintageRaw(raw);
    if (errors.vintage) setErrors((prev) => ({ ...prev, vintage: undefined }));
    if (raw === '') {
      setVintage(null);
    } else {
      const n = parseInt(raw, 10);
      // Store the parsed number regardless of range — validation
      // catches out-of-range at save time so the user sees an error.
      setVintage(n);
    }
    if (isLowConfidence) setUserEdited(true);
  };
  const handleKindChange = (k: Kind) => {
    setKind(k);
    if (errors.kind) setErrors((prev) => ({ ...prev, kind: undefined }));
    if (isLowConfidence) setUserEdited(true);
  };

  // Validate and gate the save — blocks the call on invalid fields,
  // retains all edits, and shows field-level error messages.
  const handleValidatedSave = async (): Promise<string | void> => {
    const edited: EditedIdentity = { name, producer, region, vintage, kind };
    const validationErrors = validateIdentity(edited);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    return onSave(edited);
  };

  const meta = [
    vintage,
    result.abv && `${result.abv}%`,
    region || result.region,
  ].filter(Boolean);
  const contextLine = [producer || result.producer, region || result.region, vintage]
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
        {/* --- Editable Identity Fields --- */}
        <div className="scard__identity">
          <div className="scard__field-wrap">
            <input
              type="text"
              className={`scard__input scard__input--name t-display${errors.name ? ' scard__input--error' : ''}`}
              value={name}
              onChange={handleNameChange}
              maxLength={200}
              placeholder="Name"
              aria-label="Name"
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="scard__field-error t-caption" role="alert">{errors.name}</p>
            )}
          </div>
          <input
            type="text"
            className="scard__input scard__input--producer t-label"
            value={producer}
            onChange={handleProducerChange}
            maxLength={200}
            placeholder="Producer"
            aria-label="Producer"
          />
          <input
            type="text"
            className="scard__input scard__input--region t-label"
            value={region}
            onChange={handleRegionChange}
            maxLength={200}
            placeholder="Region"
            aria-label="Region"
          />
          <div className="scard__vintage-row">
            <input
              type="text"
              inputMode="numeric"
              className={`scard__input scard__input--vintage t-mono tnum${errors.vintage ? ' scard__input--error' : ''}`}
              value={vintageRaw}
              onChange={handleVintageChange}
              placeholder="Year"
              aria-label="Vintage year"
              aria-invalid={!!errors.vintage}
            />
            {errors.vintage && (
              <p className="scard__field-error t-caption" role="alert">{errors.vintage}</p>
            )}
          </div>
          <div className="scard__kind-wrap">
            <div className={`scard__kind-seg${errors.kind ? ' scard__kind-seg--error' : ''}`} role="radiogroup" aria-label="Beverage type">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  className={`scard__kind-opt${kind === k ? ' is-active' : ''}`}
                  onClick={() => handleKindChange(k)}
                >
                  {k}
                </button>
              ))}
            </div>
            {errors.kind && (
              <p className="scard__field-error t-caption" role="alert">{errors.kind}</p>
            )}
          </div>
        </div>

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
            {!settled && (
              <button
                type="button"
                className="scard__confirm-btn"
                onClick={() => setUserConfirmed(true)}
              >
                Looks right to me
              </button>
            )}
            {settled && (
              <p className="scard__settled-note t-caption">Identity confirmed.</p>
            )}
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
            onSave={handleValidatedSave}
            saved={!!saved}
            savedEntryId={savedEntryId}
            drinkName={name || result.name}
            contextLine={contextLine || undefined}
            disabled={!settled}
          />
          {!settled && (
            <p className="scard__unsettled-hint t-caption">
              Edit a field or confirm above to save.
            </p>
          )}
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
        .scard__identity {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 20px;
        }
        .scard__input {
          background: transparent;
          border: 1px solid transparent;
          border-radius: var(--radius-sm, 6px);
          padding: 6px 8px;
          color: var(--bone);
          width: 100%;
          transition: border-color 180ms var(--ease-standard),
            background 180ms var(--ease-standard);
        }
        .scard__input:hover {
          border-color: var(--border-subtle);
        }
        .scard__input:focus {
          outline: none;
          border-color: var(--ember);
          background: color-mix(in oklch, var(--smoke) 80%, var(--midnight));
        }
        .scard__input::placeholder {
          color: color-mix(in oklch, var(--bone) 35%, transparent);
        }
        .scard__input--name {
          font-size: clamp(20px, 4vw, 28px);
          font-weight: 600;
          line-height: 1.2;
          padding: 4px 8px;
        }
        .scard__input--producer {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          opacity: 0.8;
        }
        .scard__input--region {
          font-size: 14px;
          opacity: 0.8;
        }
        .scard__vintage-row {
          max-width: 100px;
        }
        .scard__input--vintage {
          font-size: 14px;
          letter-spacing: 0.02em;
          font-variant-numeric: tabular-nums;
        }
        .scard__kind-seg {
          display: inline-flex;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-pill, 999px);
          overflow: hidden;
          margin-top: 8px;
        }
        .scard__kind-opt {
          padding: 6px 14px;
          font-size: 13px;
          text-transform: capitalize;
          color: color-mix(in oklch, var(--bone) 70%, transparent);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 150ms var(--ease-standard),
            background 150ms var(--ease-standard);
        }
        .scard__kind-opt:not(:last-child) {
          border-right: 1px solid var(--border-subtle);
        }
        .scard__kind-opt:hover {
          color: var(--bone);
          background: color-mix(in oklch, var(--smoke) 60%, var(--midnight));
        }
        .scard__kind-opt.is-active {
          color: var(--bone);
          background: color-mix(in oklch, var(--ember) 15%, var(--smoke));
          font-weight: 500;
        }
        .scard__field-wrap {
          display: flex;
          flex-direction: column;
        }
        .scard__kind-wrap {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .scard__input--error {
          border-color: color-mix(in oklch, var(--ember) 70%, var(--bone));
        }
        .scard__kind-seg--error {
          border-color: color-mix(in oklch, var(--ember) 70%, var(--bone));
        }
        .scard__field-error {
          margin: 4px 0 0 8px;
          color: color-mix(in oklch, var(--ember) 80%, var(--bone));
          font-size: 12px;
          line-height: 1.3;
        }
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
        .scard__confirm-btn {
          display: inline-block;
          margin-top: 14px;
          padding: 8px 18px;
          font: 500 14px var(--font-geist);
          color: var(--bone);
          background: transparent;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-pill, 999px);
          cursor: pointer;
          transition: border-color 180ms var(--ease-standard),
            background 180ms var(--ease-standard);
        }
        .scard__confirm-btn:hover {
          border-color: var(--ember);
          background: color-mix(in oklch, var(--ember) 8%, transparent);
        }
        .scard__settled-note {
          margin-top: 12px;
          color: var(--verde);
          font-style: italic;
        }
        .scard__unsettled-hint {
          text-align: center;
          margin-top: 8px;
          color: color-mix(in oklch, var(--bone) 50%, transparent);
        }
      `}</style>
    </motion.article>
  );
}
