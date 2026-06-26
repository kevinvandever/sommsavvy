import { motion, AnimatePresence } from 'motion/react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { EASE, DUR, SPRING } from '../lib/motion';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  // Higher z-index for nested sheets (auth sheet over result, etc.)
  layer?: number;
  // Don't dismiss on backdrop tap (e.g. forced auth flow)
  blocking?: boolean;
  // Compact mode for things like the text input sheet
  compact?: boolean;
}

// Reusable bottom sheet (mobile) / centered modal (desktop). Slides up,
// backdrop blurs, escape and tap-outside dismiss. On mobile, lifts above
// the soft keyboard (and the iOS autofill bar) when an input is focused.
export function Sheet({ open, onClose, children, layer = 50, blocking, compact }: Props) {
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !blocking) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, blocking]);

  // Track the visual viewport so the sheet can rise above the soft
  // keyboard on iOS and Android. iOS Safari adds an autofill suggestion
  // bar above the keyboard that occludes inputs; we add a small extra
  // buffer so the focused input is always clearly visible.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // The amount of layout viewport hidden below the visual viewport.
      // When the keyboard is up, this is roughly the keyboard height.
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      // Only react when the keyboard is meaningfully up (>120px) so we
      // don't trigger on minor browser-chrome resize events.
      if (hidden > 120) {
        // Add ~48px buffer for the iOS autofill suggestion bar.
        setKeyboardOffset(hidden + 48);
      } else {
        setKeyboardOffset(0);
      }
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setKeyboardOffset(0);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            style={{ zIndex: layer }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.std, ease: EASE.exit }}
            onClick={blocking ? undefined : onClose}
          />
          <motion.div
            className={`sheet ${compact ? 'sheet--compact' : ''}`}
            style={{
              zIndex: layer + 1,
              // Lift the sheet above the soft keyboard + autofill bar.
              // On desktop, keyboardOffset stays 0.
              ['--keyboard-offset' as string]: `${keyboardOffset}px`,
            }}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={SPRING.sheet}
            role="dialog"
            aria-modal="true"
          >
            <div className="sheet__handle" aria-hidden="true" />
            <div className="sheet__body">{children}</div>
          </motion.div>
          <style>{`
            .sheet-backdrop {
              position: fixed; inset: 0;
              background: color-mix(in oklch, var(--midnight) 60%, transparent);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
            }
            .sheet {
              position: fixed;
              left: 0; right: 0;
              bottom: var(--keyboard-offset, 0px);
              max-height: 90dvh;
              background: var(--smoke);
              border-radius: var(--radius-lg) var(--radius-lg) 0 0;
              box-shadow: var(--lift-2);
              padding: 12px 24px max(24px, env(safe-area-inset-bottom));
              overflow-y: auto;
              border-top: 1px solid var(--border-subtle);
              transition: bottom 220ms cubic-bezier(0.32, 0.72, 0.24, 1);
            }
            @media (min-width: 760px) {
              .sheet {
                left: 50%;
                right: auto;
                bottom: 50%;
                transform: translate(-50%, 50%) !important;
                max-width: 480px;
                width: calc(100% - 48px);
                max-height: 80dvh;
                border-radius: var(--radius-lg);
                padding: 24px 32px 32px;
                border: 1px solid var(--border-subtle);
                transition: none;
              }
              .sheet--compact { max-width: 540px; }
            }
            .sheet__handle {
              width: 36px; height: 4px;
              background: color-mix(in oklch, var(--bone) 30%, transparent);
              border-radius: 999px;
              margin: 4px auto 16px;
            }
            @media (min-width: 760px) {
              .sheet__handle { display: none; }
            }
            .sheet__body { padding-bottom: 8px; }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}
