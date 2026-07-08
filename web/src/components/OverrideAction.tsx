import { IconArrowsExchange } from '@tabler/icons-react';

interface Props {
  label: string;
  ambiguous: boolean;
  onOverride: () => void;
}

/**
 * A single override action rendered on the Result surface. When `ambiguous`
 * is true (the backend was uncertain about routing), this renders as an
 * elevated button with full visual weight. When false, it renders as a
 * subdued but visible secondary control.
 *
 * Only one OverrideAction is ever shown per surface:
 *   identify surface -> "Pair this instead"
 *   pair surface     -> "Identify and save"
 */
export function OverrideAction({ label, ambiguous, onOverride }: Props) {
  const className = ambiguous
    ? 'override-action override-action--prominent'
    : 'override-action override-action--subdued';

  return (
    <>
      <button className={className} onClick={onOverride} type="button">
        <IconArrowsExchange size={16} stroke={1.6} />
        {label}
      </button>

      <style>{`
        .override-action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: var(--radius-pill);
          cursor: pointer;
          font-family: var(--font-geist);
          letter-spacing: -0.005em;
          transition:
            background 180ms var(--ease-standard),
            border-color 180ms var(--ease-standard),
            box-shadow 280ms var(--ease-standard),
            transform 180ms var(--ease-standard);
        }
        .override-action:active {
          transform: scale(0.97);
        }

        /* Prominent: elevated button when the backend was uncertain */
        .override-action--prominent {
          padding: 14px 24px;
          background: var(--ember);
          color: var(--midnight);
          font-weight: 500;
          font-size: 15px;
          border: none;
        }
        .override-action--prominent:hover {
          box-shadow: var(--glow-ember);
        }

        /* Subdued: visible but not dominant when routing was confident */
        .override-action--subdued {
          padding: 10px 18px;
          background: transparent;
          color: color-mix(in oklch, var(--bone) 75%, transparent);
          font-weight: 500;
          font-size: 14px;
          border: 1px solid var(--border-subtle);
        }
        .override-action--subdued:hover {
          color: var(--parchment);
          border-color: color-mix(in oklch, var(--ember) 30%, var(--border-subtle));
        }
      `}</style>
    </>
  );
}
