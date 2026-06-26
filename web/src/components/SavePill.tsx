import { useState } from 'react';
import { IconBookmark, IconLoader2 } from '@tabler/icons-react';

interface Props {
  onSave: () => void | Promise<void>;
  saved?: boolean; // controlled state if parent owns it
}

// The Save → Saved transformation pill. Width-locked so the label swap
// doesn't shift layout. After saved, the Verde state is held briefly.
export function SavePill({ onSave, saved: controlledSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [savedLocal, setSavedLocal] = useState(false);
  // Either the parent's controlled flag OR the local optimistic flag wins.
  // The previous logic (parent prop strictly overrides) meant a parent that
  // passes `saved={false}` until its async state caught up would prevent
  // the pill from ever flipping to "Saved" — which is exactly the bug the
  // user hit. Use OR so the optimistic local update is always honored.
  const saved = !!controlledSaved || savedLocal;

  const handle = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      await onSave();
      setSavedLocal(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      className={`spill ${saved ? 'is-saved' : ''}`}
      onClick={handle}
      disabled={saving}
    >
      <span className="spill__icon">
        {saving ? <IconLoader2 className="spin" size={16} /> : <IconBookmark size={16} stroke={1.6} fill={saved ? 'currentColor' : 'none'} />}
      </span>
      <span className="spill__labels">
        <span className={`spill__label ${saved ? 'is-out' : ''}`}>Save to Cellar</span>
        <span className={`spill__label spill__label--saved ${saved ? '' : 'is-out'}`}>Saved</span>
      </span>
      <style>{`
        .spill {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 14px 22px;
          background: var(--ember);
          color: var(--midnight);
          border-radius: 999px;
          font: 500 15px var(--font-geist);
          letter-spacing: -0.005em;
          min-width: 200px;
          justify-content: center;
          transition:
            background 200ms var(--ease-standard),
            color 200ms var(--ease-standard),
            box-shadow 280ms var(--ease-standard),
            transform 180ms var(--ease-standard);
        }
        .spill:hover:not(:disabled):not(.is-saved) { box-shadow: var(--glow-ember); }
        .spill:active:not(:disabled) { transform: scale(0.97); }
        .spill.is-saved {
          background: var(--smoke);
          color: var(--verde);
          box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--verde) 40%, transparent);
        }
        .spill__icon { display: grid; place-items: center; width: 16px; height: 16px; }
        .spill__labels { position: relative; height: 1.2em; min-width: 110px; overflow: hidden; }
        .spill__label {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          transition: transform 280ms var(--ease-standard), opacity 220ms var(--ease-standard);
        }
        .spill__label.is-out {
          transform: translateY(-100%);
          opacity: 0;
        }
        .spill__label--saved.is-out {
          transform: translateY(100%);
          opacity: 0;
        }
      `}</style>
    </button>
  );
}
