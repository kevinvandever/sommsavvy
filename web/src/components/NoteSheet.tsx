import { useEffect, useRef, useState } from 'react';
import { IconBottle } from '@tabler/icons-react';
import { Sheet } from './Sheet';
import { Switch } from './Switch';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (note: string) => void | Promise<void>;
  // The drink being noted — shown as a small editorial header inside the
  // sheet so the user has a clear anchor for what they're writing about.
  drinkName: string;
  // Optional producer / vintage context shown below the name.
  contextLine?: string;
  // Ownership dimension. Controlled by the parent so it can persist the
  // moment it's toggled (independent of whether a note is written) — the
  // entry is already saved by the time this sheet is open.
  owned: boolean;
  onOwnedChange: (next: boolean) => void;
}

// The Add-a-note bottom sheet. Opens after the user taps the tertiary
// "Add a note" link beneath a saved pill. Capture happens here rather
// than on the result card itself because the cards are deliberately
// editorial and stuffing a textarea into one breaks the design.
//
// Skipping is a first-class action — the closing caption is "Skip is
// fine. Honesty helps." That copy turns notes from a journaling chore
// into an act of personalization, matching the language on the Profile
// page's depth dial. Empty notes are treated as a skip.
export function NoteSheet({ open, onClose, onSave, drinkName, contextLine, owned, onOwnedChange }: Props) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset on close so reopening starts clean. Autofocus on open so the
  // keyboard rises immediately on mobile.
  useEffect(() => {
    if (!open) {
      setNote('');
      setSaving(false);
      return;
    }
    const id = window.setTimeout(() => taRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [open]);

  const handleSave = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} compact>
      <div className="nsheet">
        <p className="t-aside nsheet__eyebrow">Add a note</p>
        <h3 className="t-headline nsheet__title">{drinkName}</h3>
        {contextLine && <p className="t-caption nsheet__ctx">{contextLine}</p>}

        <textarea
          ref={taRef}
          className="nsheet__ta"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's the moment? Where did you find it? What was on the plate? Any of it. All optional."
          rows={4}
          maxLength={1000}
        />

        <p className="t-caption nsheet__hint">
          Notes shape how I read you. Skip is fine. Honesty helps.
        </p>

        {/* Ownership row. A different concern from the note, so a full-width
            hairline divider separates it. Off by default — most saves are
            things tasted, not bottles held. The whole row is tappable. */}
        <div className="nsheet__divider" />
        <div
          className="nsheet__own"
          role="presentation"
          onClick={() => onOwnedChange(!owned)}
        >
          <IconBottle size={18} stroke={1.5} className="nsheet__own-glyph" />
          <span className="nsheet__own-label">I have a bottle of this</span>
          <Switch
            checked={owned}
            onChange={onOwnedChange}
            ariaLabel="I have a bottle of this"
          />
        </div>

        <div className="nsheet__actions">
          <button type="button" className="btn-tertiary" onClick={onClose} disabled={saving}>
            Skip
          </button>
          <button
            type="button"
            className="nsheet__save"
            onClick={handleSave}
            disabled={saving || !note.trim()}
          >
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>

        <style>{`
          .nsheet {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 4px 0 8px;
          }
          .nsheet__eyebrow {
            color: color-mix(in oklch, var(--bone) 55%, transparent);
            letter-spacing: 0.08em;
            text-transform: uppercase;
            font-size: 11px;
          }
          .nsheet__title {
            font-size: clamp(20px, 3vw, 26px);
            line-height: 1.15;
            color: var(--bone);
            margin: 0;
          }
          .nsheet__ctx {
            color: color-mix(in oklch, var(--bone) 55%, transparent);
            margin: -4px 0 0;
          }
          .nsheet__ta {
            margin-top: 8px;
            background: color-mix(in oklch, var(--midnight) 30%, transparent);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 14px 16px;
            color: var(--bone);
            font: 400 16px/1.5 var(--font-geist);
            resize: vertical;
            min-height: 110px;
            max-height: 280px;
            transition: border-color 200ms var(--ease-standard);
          }
          .nsheet__ta::placeholder {
            color: color-mix(in oklch, var(--bone) 35%, transparent);
            font-style: italic;
            font-family: var(--font-rowan, var(--font-geist));
          }
          .nsheet__ta:focus-visible {
            outline: none;
            border-color: var(--ember);
          }
          .nsheet__hint {
            color: color-mix(in oklch, var(--bone) 50%, transparent);
            font-style: italic;
            font-family: var(--font-rowan, var(--font-geist));
            margin: 4px 0 0;
          }
          .nsheet__divider {
            height: 1px;
            background: var(--border-subtle);
            margin: 16px -20px 0;
          }
          .nsheet__own {
            display: flex;
            align-items: center;
            gap: 11px;
            min-height: 48px;
            padding: 6px 0;
            cursor: pointer;
            -webkit-user-select: none;
            user-select: none;
          }
          .nsheet__own-glyph {
            color: color-mix(in oklch, var(--bone) 55%, transparent);
            transition: color 200ms var(--ease-standard);
          }
          .nsheet__own-label {
            flex: 1;
            font: 500 15px var(--font-geist);
            color: var(--bone);
            transition: color 200ms var(--ease-standard);
          }
          /* When owned, the glyph and label brighten to full Bone/Parchment
             alongside the switch lighting up — a single coherent on-state. */
          .nsheet__own:has(.uiswitch.is-on) .nsheet__own-glyph {
            color: var(--bone);
          }
          .nsheet__own:has(.uiswitch.is-on) .nsheet__own-label {
            color: var(--parchment);
          }
          .nsheet__actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 16px;
            gap: 16px;
          }
          .nsheet__save {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 12px 22px;
            border-radius: 999px;
            background: var(--ember);
            color: var(--midnight);
            font: 500 15px var(--font-geist);
            letter-spacing: -0.005em;
            min-width: 140px;
            transition:
              background 200ms var(--ease-standard),
              opacity 200ms var(--ease-standard),
              box-shadow 240ms var(--ease-standard);
          }
          .nsheet__save:hover:not(:disabled) {
            box-shadow: var(--glow-ember);
          }
          .nsheet__save:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    </Sheet>
  );
}
