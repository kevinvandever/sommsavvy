import { motion } from 'motion/react';
import { useStore } from '../store';
import { EASE, DUR } from '../lib/motion';

// Pocket Somm | Reverse Scan. Sliding underline animation between modes.
export function ModeToggle() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);

  return (
    <div className="mode app-chrome" role="tablist" aria-label="Mode">
      <button
        role="tab"
        aria-selected={mode === 'somm'}
        className={`mode__btn ${mode === 'somm' ? 'is-active' : ''}`}
        onClick={() => setMode('somm')}
      >
        Pocket Somm
        {mode === 'somm' && (
          <motion.span
            layoutId="mode-underline"
            className="mode__underline"
            transition={{ duration: DUR.std, ease: EASE.standard }}
          />
        )}
      </button>
      <button
        role="tab"
        aria-selected={mode === 'scan'}
        className={`mode__btn ${mode === 'scan' ? 'is-active' : ''}`}
        onClick={() => setMode('scan')}
      >
        Reverse Scan
        {mode === 'scan' && (
          <motion.span
            layoutId="mode-underline"
            className="mode__underline"
            transition={{ duration: DUR.std, ease: EASE.standard }}
          />
        )}
      </button>

      <style>{`
        .mode {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          align-self: center;
        }
        .mode__btn {
          position: relative;
          padding: 8px 16px;
          font: 500 16px var(--font-geist);
          letter-spacing: -0.005em;
          color: color-mix(in oklch, var(--bone) 60%, transparent);
          transition: color 220ms var(--ease-standard) 80ms;
        }
        @media (min-width: 760px) {
          .mode__btn { font-size: 17px; padding: 10px 20px; }
        }
        .mode__btn.is-active { color: var(--parchment); }
        .mode__underline {
          position: absolute;
          left: 16%;
          right: 16%;
          bottom: 0;
          height: 2px;
          background: var(--ember);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
