import { useEffect, useRef, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { motion } from 'motion/react';
import TextareaAutosize from 'react-textarea-autosize';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { Header } from '../components/Header';
import { Atmosphere } from '../components/Atmosphere';
import { MonocleText } from '../components/MonocleText';
import { NoteSheet } from '../components/NoteSheet';
import { OnHandCard } from '../components/OnHandCard';
import { useStore } from '../store';
import { api } from '../api';
import { img } from '../lib/cdn';
import { EASE, DUR } from '../lib/motion';
import {
  applyOnHandPatch,
  bottlesOnHand,
  outcomeMessage,
  previewOutcome,
  undoPatchFor,
  type Outcome,
} from '../lib/onHand';
import type { CellarEntry } from '../types';

// The note offered after "Drank it". It invites a line about how the bottle
// drank, including when it was not for you.
const DRANK_NOTE_PLACEHOLDER =
  'How did it drink? What was on the plate? If it was not for you, say so. All optional.';
const ON_HAND_FAILED = 'That did not take. Try again?';

export function EntryDetail() {
  const [, params] = useRoute('/cellar/:id');
  const [, navigate] = useLocation();
  const id = params?.id;

  const cellar = useStore((s) => s.cellar);
  const patchEntry = useStore((s) => s.patchEntry);
  const upsertEntry = useStore((s) => s.upsertEntry);
  const removeEntry = useStore((s) => s.removeEntry);

  const [entry, setEntry] = useState<CellarEntry | undefined>(cellar.find((e) => e.id === id));
  const [notes, setNotes] = useState(entry?.notes || '');
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Imported bottles arrive as identity only. The first time one is opened we
  // fill in its editorial context so it reads like a scanned entry. Cached on
  // the entry afterwards, so this runs once per bottle, not on every view.
  const [enriching, setEnriching] = useState(false);
  const enrichAttempted = useRef<string | null>(null);

  // On-hand card. One busy flag disables every control on the card while a
  // request is in flight. Undo covers only the most recent on-hand action and
  // lasts until the user leaves the page or makes another on-hand change.
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ message: string; patch: Partial<CellarEntry> } | null>(null);
  const [onHandError, setOnHandError] = useState<string | null>(null);
  // The note sheet that follows "Drank it".
  const [drankNoteOpen, setDrankNoteOpen] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

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

  // Fires when either the editorial text or the bottle image is missing, so
  // entries enriched before images existed still pick one up. Derived as a
  // flag so the effect below does not depend on the entry object: an on-hand
  // action (often tapped right after first opening an imported bottle)
  // replaces the entry, and that must not cancel an enrichment in flight.
  const needsEnrichment = !!entry && !(entry.whyText?.trim() && entry.photoUrl?.trim());

  // Fire-on-open enrichment. Only for entries with no editorial context yet,
  // and only once per entry per visit. Failure is silent: the page still shows
  // the identity and notes, and the next open will try again.
  useEffect(() => {
    if (!needsEnrichment || !id) return;
    if (enrichAttempted.current === id) return;
    enrichAttempted.current = id;

    let cancelled = false;
    setEnriching(true);
    api
      .enrichCellarEntry({ id })
      .then(({ entry: updated, enriched }) => {
        if (cancelled || !enriched) return;
        setEntry(updated);
        patchEntry(updated.id, updated);
      })
      .catch((err) => console.error('Entry enrichment failed', err))
      .finally(() => {
        if (!cancelled) setEnriching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsEnrichment, id, patchEntry]);

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

  // On-hand writes replace the whole entry (upsertEntry, not patchEntry), so a
  // count the server cleared is cleared in the store too.
  const commit = (next: CellarEntry) => {
    setEntry(next);
    upsertEntry(next);
  };

  // Every on-hand handler follows one shape: skip while busy, snapshot the
  // entry, draw the expected result, then replace it with the server's copy.
  // On a thrown error the card returns to its snapshot (Undo included) and
  // shows a friendly line with no technical detail.

  const turnOn = async () => {
    if (busy) return;
    const snapshot = entry;
    const prevUndo = undo;
    setBusy(true);
    setOnHandError(null);
    setUndo(null);
    commit(applyOnHandPatch(entry, { owned: true }));
    try {
      const { entry: saved } = await api.updateCellarEntry({ id: entry.id, patch: { owned: true } });
      commit(saved);
      setUndo({ message: 'In the rack.', patch: { owned: false } });
    } catch (err) {
      console.error('Turning on hand failed', err);
      commit(snapshot);
      setUndo(prevUndo);
      setOnHandError(ON_HAND_FAILED);
    } finally {
      setBusy(false);
    }
  };

  // The count control stays between 1 and 99, so it never takes the bottle
  // off the rack. It offers no Undo; the opposite button reverses it.
  const changeCount = async (next: number) => {
    if (busy) return;
    const snapshot = entry;
    const prevUndo = undo;
    setBusy(true);
    setOnHandError(null);
    setUndo(null);
    commit(applyOnHandPatch(entry, { bottleCount: next }));
    try {
      const { entry: saved } = await api.updateCellarEntry({
        id: entry.id,
        patch: { bottleCount: next },
      });
      commit(saved);
    } catch (err) {
      console.error('Bottle count update failed', err);
      commit(snapshot);
      setUndo(prevUndo);
      setOnHandError(ON_HAND_FAILED);
    } finally {
      setBusy(false);
    }
  };

  // One bottle, one outcome. The server lowers its own stored count, so a
  // stale page cannot remove a bottle that is already gone.
  const recordOutcome = async (outcome: Outcome) => {
    if (busy) return;
    const snapshot = entry;
    const prevUndo = undo;
    setBusy(true);
    setOnHandError(null);
    setUndo(null);
    commit(previewOutcome(entry, outcome));
    try {
      const { applied, rejected } = await api.recordBottleOutcomes({
        items: [
          {
            id: entry.id,
            drank: outcome === 'drank' ? 1 : 0,
            gaveAway: outcome === 'gave_away' ? 1 : 0,
          },
        ],
        surface: 'entry',
      });
      const done = applied[0];
      if (done) {
        commit(done.entry);
        setUndo({
          message: outcomeMessage(outcome, bottlesOnHand(done.entry)),
          patch: undoPatchFor(done.previous, done.entry),
        });
        if (outcome === 'drank') {
          setNoteError(null);
          setDrankNoteOpen(true);
        }
      } else {
        // The entry changed elsewhere (another tab or device). Say why, then
        // show what the server actually holds.
        commit(snapshot);
        setOnHandError(rejected[0]?.reason ?? ON_HAND_FAILED);
        try {
          const { entry: fresh } = await api.getEntry({ id: entry.id });
          commit(fresh);
        } catch {
          // Keep the snapshot; the reason is already on screen.
        }
      }
    } catch (err) {
      console.error('Bottle outcome failed', err);
      commit(snapshot);
      setUndo(prevUndo);
      setOnHandError(ON_HAND_FAILED);
    } finally {
      setBusy(false);
    }
  };

  // Restores on hand, the count, and tasted to their values before the most
  // recent action. A failed Undo stays available to try again.
  const runUndo = async () => {
    if (busy || !undo) return;
    const snapshot = entry;
    setBusy(true);
    setOnHandError(null);
    commit(applyOnHandPatch(entry, undo.patch));
    try {
      const { entry: saved } = await api.updateCellarEntry({ id: entry.id, patch: undo.patch });
      commit(saved);
      setUndo(null);
    } catch (err) {
      console.error('Undo failed', err);
      commit(snapshot);
      setOnHandError('Could not undo that. Try again?');
    } finally {
      setBusy(false);
    }
  };

  // The note after "Drank it" is added below any existing notes, never in
  // place of them. A failed save keeps the sheet open with the text intact.
  const saveDrankNote = async (note: string) => {
    setNoteError(null);
    const base = notes.trim();
    const combined = base ? `${base}\n\n${note}` : note;
    try {
      const { entry: saved } = await api.updateCellarEntry({
        id: entry.id,
        patch: { notes: combined },
      });
      commit(saved);
      setNotes(saved.notes || '');
      setDrankNoteOpen(false);
    } catch (err) {
      console.error('Drank note save failed', err);
      setNoteError('That note did not save. Try again?');
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
            {/* No photo means no hero. A letter panel added nothing, so the
                page simply opens on the text. */}
            {entry.photoUrl && (
              <div className="edet__hero">
                <img src={img(entry.photoUrl, 1200) || entry.photoUrl} alt={entry.name} />
              </div>
            )}

            <div className="edet__body">
              <p className="t-label">{entry.kind}</p>
              <h1 className="t-display edet__title">{entry.name}</h1>
              {entry.producer && <p className="t-subhead">{entry.producer}</p>}
              {meta.length > 0 && <p className="t-caption tnum">{meta.join(' · ')}</p>}

              {/* Ownership card. The management surface for the held subset:
                  mark a bottle you keep, set how many, and record how each
                  one left. Placed high (under the metadata, above the AI
                  context) so it's discoverable, not buried. */}
              <OnHandCard
                entry={entry}
                busy={busy}
                undoMessage={undo?.message ?? null}
                error={onHandError}
                onTurnOn={turnOn}
                onCountChange={changeCount}
                onOutcome={recordOutcome}
                onUndo={runUndo}
              />

              {entry.whyText ? (
                <>
                  <div className="divider" />
                  <p className="t-label edet__sec">What we found</p>
                  <MonocleText text={entry.whyText} aside={entry.monocleAside} className="t-why" />
                </>
              ) : enriching ? (
                <>
                  <div className="divider" />
                  <p className="t-label edet__sec">What we found</p>
                  <p className="t-body edet__reading">Reading up on this one</p>
                </>
              ) : null}

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

        {/* The next beat after "Drank it", as the save flow does after a
            save. No ownership row: the card's count already covers holding
            another bottle. */}
        <NoteSheet
          open={drankNoteOpen}
          onClose={() => setDrankNoteOpen(false)}
          onSave={saveDrankNote}
          drinkName={entry.name}
          contextLine={
            [entry.producer, entry.region, entry.vintage].filter(Boolean).join(' · ') || undefined
          }
          placeholder={DRANK_NOTE_PLACEHOLDER}
          error={noteError}
        />
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
        .edet__reading {
          color: color-mix(in oklch, var(--bone) 55%, transparent);
          font-style: italic;
          animation: edet-reading-pulse 1.8s ease-in-out infinite;
        }
        @keyframes edet-reading-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        .edet__body { padding: 28px; }
        @media (min-width: 760px) { .edet__body { padding: 40px 48px; } }
        .edet__title { margin: 4px 0 6px; }
        .edet__sec { margin-top: 18px; margin-bottom: 8px; }
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
