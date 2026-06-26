import { IconCamera } from '@tabler/icons-react';

interface Props {
  onCapture: () => void;
  disabled?: boolean;
}

// The big circular Ember shutter. Idle breathing pilot light, tap-to-capture
// scale + flash. Width-locked so the spinner state doesn't shift the layout.
export function Shutter({ onCapture, disabled }: Props) {
  return (
    <button
      type="button"
      className="shutter app-chrome"
      onClick={onCapture}
      disabled={disabled}
      aria-label="Capture"
    >
      <IconCamera size={26} stroke={1.6} />
      <span className="shutter__pilot" aria-hidden="true" />
      <style>{`
        .shutter {
          position: relative;
          display: grid; place-items: center;
          width: 72px; height: 72px;
          background: var(--ember);
          color: var(--midnight);
          border-radius: 999px;
          box-shadow:
            0 0 0 0 color-mix(in oklch, var(--ember) 0%, transparent),
            var(--lift-2);
          transition:
            transform 60ms var(--ease-exit),
            box-shadow 280ms var(--ease-standard);
        }
        @media (min-width: 760px) {
          .shutter { width: 88px; height: 88px; }
          .shutter svg { width: 30px; height: 30px; }
        }
        .shutter:hover:not(:disabled) {
          box-shadow: var(--glow-ember), var(--lift-2);
        }
        .shutter:active:not(:disabled) {
          transform: scale(0.96);
        }
        .shutter:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        /* Idle pilot light: outer ring breathes */
        .shutter__pilot {
          position: absolute;
          inset: -8px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklch, var(--ember) 30%, transparent);
          opacity: 0;
          transition: opacity 280ms var(--ease-standard);
          animation: shutter-breath 3.6s ease-in-out infinite;
        }
        .shutter:hover .shutter__pilot { animation: none; opacity: 1; }
        @keyframes shutter-breath {
          0%, 100% { opacity: 0; }
          50%      { opacity: 1; }
        }
      `}</style>
    </button>
  );
}
