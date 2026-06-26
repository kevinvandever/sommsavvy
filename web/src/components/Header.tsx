import { useStore } from '../store';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'motion/react';
import { DUR, EASE } from '../lib/motion';

// The typographic SommSavvy monogram. An italic Rowan "S" rendered in a
// brass/Ember gradient on a Smoke disc. Cleaner and crisper than a raster
// image, scales without artefacts, and reads at 24px through 64px.
function Monogram({ size = 32 }: { size?: number }) {
  return (
    <span
      className="mono"
      aria-label="SommSavvy"
      style={{ width: size, height: size, fontSize: size * 0.62 }}
    >
      <span className="mono__s">S</span>
      <style>{`
        .mono {
          display: inline-grid;
          place-items: center;
          border-radius: 8px;
          background: linear-gradient(140deg in oklch,
            color-mix(in oklch, var(--smoke) 80%, var(--midnight)),
            color-mix(in oklch, var(--smoke) 95%, var(--ember) 5%));
          border: 1px solid color-mix(in oklch, var(--ember) 18%, var(--border-subtle));
          box-shadow: 0 0 12px color-mix(in oklch, var(--ember) 18%, transparent),
                      inset 0 1px 0 0 color-mix(in oklch, var(--ember) 14%, transparent);
          line-height: 1;
          font-family: var(--font-rowan);
          font-style: italic;
          font-weight: 500;
          color: var(--ember);
          /* Make the brass glyph look like polished metal: subtle gradient on the letter. */
          background-clip: padding-box;
        }
        .mono__s {
          color: var(--ember);
          text-shadow:
            0 1px 0 color-mix(in oklch, var(--midnight) 70%, transparent),
            0 0 8px color-mix(in oklch, var(--ember) 35%, transparent);
          letter-spacing: -0.04em;
          /* Pull the italic ascender up a hair so the S sits centered. */
          transform: translateY(-1px);
          display: inline-block;
        }
      `}</style>
    </span>
  );
}

// Quiet header with monogram (left) and cellar count or sign-in (right).
// The center is intentionally empty — the header is meant to recede.
// Depth preference lives in the profile, not here.
export function Header() {
  const [, navigate] = useLocation();
  const cellarCount = useStore((s) => s.cellarCount);
  const user = useStore((s) => s.user);

  return (
    <header className="hdr app-chrome" role="banner">
      <button className="hdr__brass" onClick={() => navigate('/profile')} aria-label="Profile">
        <Monogram size={32} />
      </button>

      <div className="hdr__spacer" aria-hidden="true" />

      <div className="hdr__right">
        <AnimatePresence mode="wait" initial={false}>
          {user ? (
            <motion.button
              key="cellar"
              className="hdr__cellar t-label tnum"
              onClick={() => navigate('/cellar')}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DUR.fast, ease: EASE.standard }}
              aria-label={`${cellarCount} in cellar`}
            >
              <span className="tnum">{cellarCount}</span>
              <span className="hdr__cellar-word">in cellar</span>
            </motion.button>
          ) : (
            <motion.button
              key="sign"
              className="btn-tertiary hdr__signin"
              onClick={() => navigate('/cellar')}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DUR.fast, ease: EASE.standard }}
            >
              Sign in
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .hdr {
          position: relative;
          z-index: 5;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 14px 16px calc(14px + env(safe-area-inset-top, 0px));
          padding-top: max(14px, env(safe-area-inset-top, 0px));
        }
        @media (min-width: 760px) {
          .hdr { padding: 22px 32px; }
        }
        .hdr__brass {
          padding: 0;
          border-radius: 8px;
          line-height: 0;
          transition: transform 240ms var(--ease-standard), filter 240ms var(--ease-standard);
        }
        .hdr__brass:hover {
          transform: rotate(2deg);
          filter: drop-shadow(0 0 12px color-mix(in oklch, var(--ember) 40%, transparent));
        }
        .hdr__spacer {
          /* Holds the empty center column open. */
        }
        .hdr__right {
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }
        .hdr__cellar {
          display: inline-flex;
          gap: 6px;
          padding: 6px 8px;
          color: var(--bone);
          background: none;
          white-space: nowrap;
          transition: color 180ms var(--ease-standard);
        }
        .hdr__cellar:hover { color: var(--ember); }
        .hdr__cellar-word { color: color-mix(in oklch, var(--bone) 70%, transparent); }
        .hdr__signin { padding: 6px 12px; }

        @media (max-width: 480px) {
          .hdr__cellar-word { display: none; }
        }
      `}</style>
    </header>
  );
}
