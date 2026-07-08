import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SavePill } from './SavePill';
import { NoteSheet } from './NoteSheet';
import { api } from '../api';
import { useStore } from '../store';
import { EASE, DUR } from '../lib/motion';

interface Props {
  // Fires the save. Should return the saved entry's id so we can attach
  // a note to it. If it returns void (e.g. the auth-gated path stashes
  // the save and shows the auth sheet), the note sheet auto-opens on
  // the subsequent auth-resolved save via the savedEntryId prop arriving.
  onSave: () => Promise<string | void>;
  // Externally controlled "this card is saved" flag — used so the saved
  // state survives navigation and re-renders.
  saved: boolean;
  // If a saved entry id is already known (e.g. user navigated back to a
  // result they've previously saved, or the auth path resolved the save
  // upstream), pass it through. When it transitions undefined → defined,
  // the note sheet auto-opens once.
  savedEntryId?: string;
  // The drink name shown inside the note sheet as the editorial anchor.
  drinkName: string;
  // Optional secondary context line ("Domaine Tempier — Bandol 2020").
  contextLine?: string;
  // When true, the save action is disabled (unsettled low-confidence state).
  disabled?: boolean;
}

// SavePill + auto-opening note sheet. Tapping Save fires the save
// immediately (one-tap preserved); the note sheet then rises as the
// next beat in the same flow. Skipping is a first-class action so users
// who don't want to write a note dismiss instantly. This is the
// "integrated into the save process" design — notes are part of the
// save gesture, not a discoverable follow-up affordance.
//
// We still render a quiet "+ Add a note" tertiary link as a re-opener
// for the case where the user dismissed the auto-opened sheet but
// changes their mind a few seconds later. After a non-empty note is
// saved, that link is replaced with a "Noted." caption.
export function SaveWithNote({
  onSave,
  saved,
  savedEntryId: initialEntryId,
  drinkName,
  contextLine,
  disabled,
}: Props) {
  // Track the entry id locally so a fresh save flips state without
  // waiting for the parent to plumb the id back through.
  const [entryId, setEntryId] = useState<string | undefined>(initialEntryId);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Becomes true once a non-empty note has been saved in this session.
  // Drives the swap from "Add a note" link to the "Noted." caption.
  const [noted, setNoted] = useState(false);
  // Ownership dimension for the just-saved entry. Defaults off — most saves
  // are things tasted, not bottles held. Persists the instant it's toggled.
  const [owned, setOwned] = useState(false);
  // One-shot guard so we auto-open the sheet exactly once per save event,
  // not on every subsequent re-render. Reset when the parent navigates
  // away from this result (entryId changes to something else, or saved
  // flips back to false).
  const autoOpenedRef = useRef(false);
  const patchEntry = useStore((s) => s.patchEntry);

  // Auto-open the note sheet when an entry id first arrives — covers
  // both the direct save path (handleSave returns the id below) AND the
  // auth-resolved path (parent supplies savedEntryId after auth success).
  // Skipping isn't penalized: the user can swipe down, tap Skip, or tap
  // the backdrop, and the save still stands.
  useEffect(() => {
    if (initialEntryId && initialEntryId !== entryId) {
      setEntryId(initialEntryId);
    }
    if (saved && entryId && !autoOpenedRef.current && !noted) {
      autoOpenedRef.current = true;
      setSheetOpen(true);
    }
  }, [initialEntryId, entryId, saved, noted]);

  const handleSave = async () => {
    const id = await onSave();
    if (typeof id === 'string') {
      setEntryId(id);
      // Direct save path — open the sheet immediately rather than
      // waiting for the effect tick. Sets the same one-shot guard.
      if (!autoOpenedRef.current && !noted) {
        autoOpenedRef.current = true;
        setSheetOpen(true);
      }
    }
  };

  const handleNoteSave = async (note: string) => {
    if (!entryId) return;
    // Optimistic: patch the store immediately so the cellar detail page
    // reflects the new note without a round-trip. The backend call
    // happens in parallel and triggers a taste-summary regeneration
    // server-side (see updateCellarEntry).
    patchEntry(entryId, { notes: note });
    setNoted(true);
    setSheetOpen(false);
    try {
      await api.updateCellarEntry({ id: entryId, patch: { notes: note } });
    } catch (err) {
      // Rollback the optimistic patch on failure. Realistically rare;
      // the user can also edit the note from the entry detail page.
      console.error('Failed to save note:', err);
      patchEntry(entryId, { notes: '' });
      setNoted(false);
    }
  };

  // Ownership persists the moment it's toggled, independent of the note.
  // The entry is already saved by the time the sheet is open, so this is a
  // simple optimistic patch + background update. No taste regen fires —
  // updateCellarEntry only regenerates on taste-affecting fields, and owned
  // is not one of them.
  const handleOwnedChange = async (next: boolean) => {
    if (!entryId) return;
    setOwned(next);
    patchEntry(entryId, { owned: next });
    try {
      await api.updateCellarEntry({ id: entryId, patch: { owned: next } });
    } catch (err) {
      console.error('Failed to update ownership:', err);
      // Roll back on failure.
      setOwned(!next);
      patchEntry(entryId, { owned: !next });
    }
  };

  // Show the "Add a note" link only when:
  //   1. The save has completed (saved is true)
  //   2. We have an entry id to attach the note to
  //   3. The user hasn't already added a note in this session
  const canShowAddNote = saved && entryId && !noted;

  return (
    <div className="swn">
      <SavePill onSave={handleSave} saved={saved} disabled={disabled} />

      <AnimatePresence mode="wait">
        {canShowAddNote && (
          <motion.button
            key="add-note"
            type="button"
            className="swn__add btn-tertiary"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DUR.fast, ease: EASE.standard, delay: 0.1 }}
            onClick={() => setSheetOpen(true)}
          >
            + Add a note
          </motion.button>
        )}
        {noted && (
          <motion.p
            key="noted"
            className="swn__noted t-caption"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast, ease: EASE.standard }}
          >
            Noted. <span className="swn__noted-edit">Edit from the cellar.</span>
          </motion.p>
        )}
      </AnimatePresence>

      <NoteSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={handleNoteSave}
        drinkName={drinkName}
        contextLine={contextLine}
        owned={owned}
        onOwnedChange={handleOwnedChange}
      />

      <style>{`
        .swn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          /* Reserve space below the pill so the link appearing doesn't
             shift the surrounding card layout. */
          min-height: 70px;
        }
        .swn__add {
          color: color-mix(in oklch, var(--bone) 60%, transparent);
          font-size: 14px;
          padding: 4px 10px;
          letter-spacing: 0.005em;
        }
        .swn__add:hover {
          color: var(--ember);
        }
        .swn__noted {
          color: color-mix(in oklch, var(--verde) 75%, var(--bone));
          font-style: italic;
          font-family: var(--font-rowan, var(--font-geist));
          margin: 0;
        }
        .swn__noted-edit {
          color: color-mix(in oklch, var(--bone) 50%, transparent);
          font-style: normal;
          font-family: var(--font-geist);
          margin-left: 4px;
        }
      `}</style>
    </div>
  );
}
