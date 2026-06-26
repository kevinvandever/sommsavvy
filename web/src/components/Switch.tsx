import { prefersReducedMotion } from '../lib/motion';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  // Accessible label — the visible row label usually carries the meaning,
  // but the control still needs its own name for screen readers.
  ariaLabel: string;
  disabled?: boolean;
}

// The shared ownership/status switch primitive. One control, reused by the
// NoteSheet ownership row and the EntryDetail ownership card.
//
// Design language (from the brand): OFF is a recessed Smoke well with a
// hairline inset so it reads on both Smoke sheets and Midnight; ON lights
// the Bone "owned" color with a dark Midnight knob — the same Bone that
// becomes the dot on a cellar tile, so the control and the marker teach
// each other. Deliberately has NO inner state word (unlike the Daylight
// pill): the row's own label carries the meaning.
//
// 44x26 track, 20x20 knob, 3px inset → 18px travel. The knob does a one-shot
// scale pop when toggled on for a settled, tactile click (never a bounce),
// suppressed under prefers-reduced-motion.
export function Switch({ checked, onChange, ariaLabel, disabled }: Props) {
  const reduce = prefersReducedMotion();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`uiswitch ${checked ? 'is-on' : ''} ${reduce ? 'is-reduced' : ''}`}
      onClick={(e) => {
        // Stop propagation so the switch can live inside a tappable row
        // without double-firing when the row also handles clicks.
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
    >
      <span className="uiswitch__knob" />

      <style>{`
        .uiswitch {
          position: relative;
          flex-shrink: 0;
          width: 44px;
          height: 26px;
          border-radius: var(--radius-pill);
          background: var(--switch-track-off);
          box-shadow: inset 0 0 0 1px var(--border-subtle);
          cursor: pointer;
          transition: background 220ms var(--ease-standard),
            box-shadow 220ms var(--ease-standard);
          -webkit-user-select: none;
          user-select: none;
        }
        .uiswitch:focus-visible {
          outline: 2px solid var(--ember);
          outline-offset: 2px;
        }
        .uiswitch:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .uiswitch.is-on {
          background: var(--switch-track-on);
          box-shadow: none;
        }
        .uiswitch__knob {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          border-radius: var(--radius-pill);
          background: var(--switch-knob-off);
          transition: transform 220ms var(--ease-standard),
            background 220ms var(--ease-standard);
        }
        .uiswitch.is-on .uiswitch__knob {
          background: var(--switch-knob-on);
          transform: translateX(18px);
          animation: uiswitch-pop 280ms var(--ease-standard);
        }
        @keyframes uiswitch-pop {
          0% { transform: translateX(18px) scale(1); }
          40% { transform: translateX(18px) scale(1.12); }
          100% { transform: translateX(18px) scale(1); }
        }
        /* Reduced motion: instant swap, no knob pop. */
        .uiswitch.is-reduced,
        .uiswitch.is-reduced .uiswitch__knob {
          transition: none;
        }
        .uiswitch.is-reduced.is-on .uiswitch__knob {
          animation: none;
        }
      `}</style>
    </button>
  );
}
