import { motion, AnimatePresence } from 'motion/react';
import { EASE, DUR } from '../lib/motion';

interface Props {
  active: boolean;
  status: string;
  capturedDataUrl: string | null;
}

// Full-screen scanning overlay used while pocketSomm/reverseScan run. The
// captured photo holds in place, dims, and an Ember-glow line traces the
// label area while status text rotates beneath.
export function ScanningOverlay({ active, status, capturedDataUrl }: Props) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="scan"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.std, ease: EASE.standard }}
          aria-live="polite"
          aria-label={status}
        >
          {capturedDataUrl && (
            <motion.img
              layoutId="scanned-photo"
              className="scan__photo"
              src={capturedDataUrl}
              alt=""
            />
          )}

          <div className="scan__dim" />

          {/*
            Ember tracer. Pure CSS div instead of an SVG <rect> because
            Safari and Chrome disagree on how CSS transforms apply to SVG
            children when the parent uses preserveAspectRatio="none" — on
            iOS the bar only traveled a fraction of the viewport. A plain
            div with dvh-based translateY behaves identically on every
            browser and tracks the dynamic viewport height correctly
            even when the iOS address bar collapses or expands mid-scan.
          */}
          <div className="scan__bar" aria-hidden="true" />

          {/* Status line */}
          <div className="scan__status-wrap">
            <AnimatePresence mode="wait">
              <motion.span
                key={status}
                className="scan__status t-mono"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: EASE.standard }}
              >
                <span className="scan__dot" /> {status}
              </motion.span>
            </AnimatePresence>
          </div>

          <style>{`
            .scan {
              position: fixed; inset: 0;
              z-index: 100;
              background: var(--midnight);
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .scan__photo {
              width: 100%;
              height: 100%;
              object-fit: cover;
              position: absolute; inset: 0;
            }
            .scan__dim {
              position: absolute; inset: 0;
              background: color-mix(in oklch, var(--midnight) 60%, transparent);
            }
            .scan__bar {
              position: absolute;
              left: 0;
              right: 0;
              top: 0;
              height: 6px;
              /* Gradient fades the bar's top and bottom edges so the line
                 reads as a soft glow rather than a hard rectangle, matching
                 the old SVG linearGradient. */
              background: linear-gradient(
                to bottom,
                transparent 0%,
                color-mix(in oklch, var(--ember) 95%, transparent) 50%,
                transparent 100%
              );
              /* Outer glow replaces the SVG feGaussianBlur filter. */
              box-shadow: 0 0 18px color-mix(in oklch, var(--ember) 55%, transparent);
              pointer-events: none;
              will-change: transform;
              animation: scan-traverse 1.3s cubic-bezier(0.5, 0, 0.5, 1) infinite alternate;
            }
            @keyframes scan-traverse {
              /* dvh tracks the dynamic viewport on iOS — the bar travels the
                 full visible height regardless of the address bar's state. */
              0%   { transform: translateY(-6px); }
              100% { transform: translateY(100dvh); }
            }
            .scan__status-wrap {
              position: absolute;
              left: 0; right: 0; bottom: 12vh;
              text-align: center;
              z-index: 2;
            }
            .scan__status {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              color: color-mix(in oklch, var(--bone) 75%, transparent);
            }
            .scan__dot {
              display: inline-block;
              width: 6px; height: 6px;
              border-radius: 999px;
              background: var(--ember);
              animation: scan-dot 1.4s ease-in-out infinite;
            }
            @keyframes scan-dot {
              0%, 100% { opacity: 0.4; }
              50%      { opacity: 1; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
