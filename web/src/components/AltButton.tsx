import type { ReactNode } from 'react';

interface Props {
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
  invite?: boolean;
  inviteDelay?: number;
}

// The small Smoke-circle voice/text icon buttons flanking the shutter. The
// `invite` prop runs a one-off breathing animation to draw the eye on first
// home visit (controlled by Home).
export function AltButton({ onClick, ariaLabel, children, invite, inviteDelay = 0 }: Props) {
  return (
    <button
      type="button"
      className={`alt app-chrome ${invite ? 'is-inviting' : ''}`}
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ animationDelay: `${inviteDelay}ms` }}
    >
      {children}
      <style>{`
        .alt {
          width: 44px; height: 44px;
          border-radius: 999px;
          background: var(--smoke);
          color: var(--bone);
          border: 1px solid var(--border-subtle);
          display: grid; place-items: center;
          transition:
            color 180ms var(--ease-standard),
            background 180ms var(--ease-standard),
            border-color 180ms var(--ease-standard),
            transform 180ms var(--ease-standard);
        }
        @media (min-width: 760px) {
          .alt { width: 56px; height: 56px; }
          .alt svg { width: 24px; height: 24px; }
        }
        .alt:hover {
          color: var(--ember);
          border-color: color-mix(in oklch, var(--ember) 40%, transparent);
          background: color-mix(in oklch, var(--smoke) 80%, var(--ember));
        }
        .alt:active { transform: scale(0.94); }
        .alt.is-inviting {
          animation: alt-invite 2.4s var(--ease-standard) 1;
        }
        @keyframes alt-invite {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.7; transform: scale(1.04); }
        }
      `}</style>
    </button>
  );
}
