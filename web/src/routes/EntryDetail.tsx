import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { motion } from 'motion/react';
import TextareaAutosize from 'react-textarea-autosize';
import { IconArrowLeft, IconTrash, IconBottle } from '@tabler/icons-react';
import { Header } from '../components/Header';
import { Atmosphere } from '../components/Atmosphere';
import { MonocleText } from '../components/MonocleText';
import { Switch } from '../components/Switch';
import { useStore } from '../store';
import { api } from '../api';
import { img } from '../lib/cdn';
import { EASE, DUR } from '../lib/motion';
import type { CellarEntry } from '../types';

export function EntryDetail() {
  const [, params] = useRoute('/cellar/:id');
  const [, navigate] = useLocation();
  const id = params?.id;

  const cellar = useStore((s) => s.cellar);
  const patchEntry = useStore((s) => s.patchEntry);
  const removeEntry = useStore((s) => s.removeEntry);

  const [entry, setEntry] = useState<CellarEntry | undefined>(cellar.find((e) => e.id === id));
  const [notes, setNotes] = useState(entry?.notes || '');
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    // Ensure we have the entry; load from server if not in cache.
    if (!entry && id) {
      api
        .getEntry({ id })
        .then(({ entry }) => {
          setEntry(entry);
          setNotes(entry.notes || '');
        })
        .catch(() => navigate('/cellar'));
    }
  }, [id, entry, navigate]);

  if (!entry) {
    return (
      <div className="canvas">
        <Atmosphere />
        <div className="app-shell">
          <Header />
          <main style={{ padding: 32, textAlign: 'center' }}>
            <p className="t-aside">Looking for that entry...</p>
          </main>
        </div>
      </div>
    );
  }

  const saveNotes = async () => {
    if (notes === (entry.notes || '')) return;
    patchEntry(entry.id, { notes });
    try {
      await api.updateCellarEntry({ id: entry.id, patch: { notes } });
    } catch (err) {
      console.error('Notes save failed', err);
    }
  };

  // Ownership is read as a real boolean: null/undefined on legacy entries
  // means not-owned (false), matching the backend default.
  const owned = entry.owned === true;

  const setOwned = async (next: boolean) => {
    patchEntry(entry.id, { owned: next });
    setEntry({ ...entry, owned: next });
    try {
      await api.updateCellarEntry({ id: entry.id, patch: { owned: next } });
    } catch (err) {
      console.error('Ownership update failed', err);
      // Roll back.
      patchEntry(entry.id, { owned: !next });
      setEntry({ ...entry, owned: !next });
    }
  };

  const remove = async () => {
    try {
      await api.removeCellarEntry({ id: entry.id });
      removeEntry(entry.id);
      navigate('/cellar');
    } catch (err) {
      console.error('Remove failed', err);
    }
  };

  const meta = [
    entry.region,
    entry.vintage,
    entry.abv && `${entry.abv}%`,
  ].filter(Boolean);

  return (
    <div className="canvas">
      <Atmosphere />
      <div className="ember-room" aria-hidden="true" />
      <div className="app-shell">
        <Header />

        <motion.main
          className="edet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.std, ease: EASE.standard }}
        >
          <button className="btn-tertiary edet__back" onClick={() => navigate('/cellar')}>
            <IconArrowLeft size={16} stroke={1.6} /> Cellar
          </button>

          <article className="edet__article">
            {entry.photoUrl ? (
              <div className="edet__hero">
                <img src={img(entry.photoUrl, 1200) || entry.photoUrl} alt={entry.name} />
              </div>
            ) : (
              <div className="edet__hero edet__hero--placeholder">
                <span className="t-aside edet__hero-letter">{entry.name.charAt(0).toUpperCase()}</span>
              </div>
            )}

            <div className="edet__body">
              <p className="t-label">{entry.kind}</p>
              <h1 className="t-display edet__title">{entry.name}</h1>
              {entry.producer && <p className="t-subhead">{entry.producer}</p>}
              {meta.length > 0 && <p className="t-caption tnum">{meta.join(' · ')}</p>}

              {/* Ownership card. The management surface for the held subset:
                  mark the whisky and gin you actually own, turn a bottle off
                  once you finish it. Placed high (under the metadata, above
                  the AI context) so it's discoverable, not buried. */}
              <div
                className="edet__own"
                role="presentation"
                onClick={() => setOwned(!owned)}
              >
                <IconBottle size={20} stroke={1.5} className="edet__own-glyph" />
                <div className="edet__own-text">
                  <span className="edet__own-label">I have a bottle of this</span>
                  {/* Fixed-height caption container — reserves the taller ON
                      variant so toggling never shifts layout. */}
                  <span className="edet__own-caption">
                    {owned
                      ? 'In the rack. Turn this off when you finish the bottle.'
                      : 'Mark it when you keep a bottle on hand.'}
                  </span>
                </div>
                <Switch checked={owned} onChange={setOwned} ariaLabel="I have a bottle of this" />
              </div>

              {entry.whyText && (
                <>
                  <div className="divider" />
                  <p className="t-label edet__sec">What we found</p>
                  <MonocleText text={entry.whyText} aside={entry.monocleAside} className="t-why" />
                </>
              )}

              <div className="divider" />
              <p className="t-label edet__sec">Your notes</p>
              <TextareaAutosize
                minRows={2}
                placeholder="A line for yourself. The Tuesday wine. Worth every penny."
                className="edet__notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
              />

              {entry.pairings && entry.pairings.length > 0 && (
                <>
                  <p className="t-label edet__sec">Pairings</p>
                  <div className="edet__pairings">
                    {entry.pairings.map((p, i) => (
                      <span key={i} className="chip">
                        {p}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {entry.occasion && (
                <>
                  <p className="t-label edet__sec">Occasion</p>
                  <p className="t-body">{entry.occasion}</p>
                </>
              )}

              {entry.valueNote && (
                <>
                  <p className="t-label edet__sec">Value</p>
                  <p className="t-body">{entry.valueNote}</p>
                </>
              )}

              <div className="divider" />
              {!confirmRemove ? (
                <button className="edet__remove" onClick={() => setConfirmRemove(true)}>
                  <IconTrash size={16} stroke={1.5} /> Remove from cellar
                </button>
              ) : (
                <div className="edet__confirm">
                  <p className="t-aside">Sure?</p>
                  <button className="btn-tertiary" onClick={() => setConfirmRemove(false)}>Keep it</button>
                  <button className="edet__remove edet__remove--confirm" onClick={remove}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          </article>
        </motion.main>
      </div>

      <style>{`
        .edet {
          flex: 1;
          padding: 8px 20px 64px;
          max-width: 720px;
          width: 100%;
          margin: 0 auto;
        }
        .edet__back { padding-left: 0; margin-bottom: 8px; }
        .edet__article {
          background: var(--smoke);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          box-shadow: var(--lift-2);
        }
        .edet__hero {
          aspect-ratio: 4 / 5;
          background: var(--midnight);
          position: relative;
          overflow: hidden;
        }
        .edet__hero img { width: 100%; height: 100%; object-fit: cover; }
        .edet__hero::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(180deg, transparent 60%, color-mix(in oklch, var(--smoke) 70%, transparent) 95%, var(--smoke) 100%);
          pointer-events: none;
        }
        .edet__hero--placeholder {
          display: grid;
          place-items: center;
          background:
            radial-gradient(ellipse 60% 70% at 50% 80%, color-mix(in oklch, var(--ember) 12%, transparent) 0%, transparent 60%),
            color-mix(in oklch, var(--midnight) 70%, var(--smoke));
        }
        .edet__hero-letter { font-size: 96px; color: color-mix(in oklch, var(--bone) 50%, transparent); font-style: italic; }
        .edet__body { padding: 28px; }
        @media (min-width: 760px) { .edet__body { padding: 40px 48px; } }
        .edet__title { margin: 4px 0 6px; }
        .edet__sec { margin-top: 18px; margin-bottom: 8px; }
        .edet__own {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 18px;
          padding: 16px 18px;
          background: var(--midnight);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          cursor: pointer;
          -webkit-user-select: none;
          user-select: none;
          transition: border-color 200ms var(--ease-standard);
        }
        .edet__own:hover {
          border-color: var(--border-strong);
        }
        .edet__own-glyph {
          color: color-mix(in oklch, var(--bone) 55%, transparent);
          flex-shrink: 0;
          transition: color 200ms var(--ease-standard);
        }
        .edet__own:has(.uiswitch.is-on) .edet__own-glyph {
          color: var(--bone);
        }
        .edet__own-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          /* Reserve the two-line height so the caption swap never shifts the
             switch or the surrounding layout. */
          min-height: 38px;
          justify-content: center;
        }
        .edet__own-label {
          font: 500 16px var(--font-geist);
          color: var(--parchment);
        }
        .edet__own-caption {
          font: 13px var(--font-geist);
          color: color-mix(in oklch, var(--bone) 60%, transparent);
          margin-top: 2px;
        }
        .edet__notes {
          width: 100%;
          background: var(--midnight);
          color: var(--parchment);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 14px;
          font: 16px var(--font-geist);
          resize: none;
        }
        .edet__notes:focus-visible { border-color: var(--ember); outline: none; }
        .edet__pairings { display: flex; flex-wrap: wrap; gap: 8px; }
        .edet__remove {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 0;
          color: color-mix(in oklch, var(--bordeaux) 70%, var(--bone));
          font: 500 14px var(--font-geist);
          letter-spacing: 0.02em;
          background: none;
          transition: color 180ms var(--ease-standard);
        }
        .edet__remove:hover { color: var(--bordeaux); }
        .edet__confirm {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        }
        .edet__remove--confirm {
          background: var(--bordeaux);
          color: var(--parchment);
          padding: 10px 18px;
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}
