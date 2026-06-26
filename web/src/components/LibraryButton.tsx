import { useRef } from 'react';
import { IconPhoto } from '@tabler/icons-react';

interface Props {
  // Fires with the user-selected file. The parent handles upload + runMethod.
  onPick: (file: File) => void;
  // Hide when the user is mid-flow (scanning, viewing captured frame) so the
  // button doesn't compete with the active capture moment.
  hidden?: boolean;
  disabled?: boolean;
}

// A small pill that sits in the bottom-left corner of the viewfinder. Tapping
// it opens the native file picker — on iOS that surfaces both "Take Photo"
// and "Photo Library", so this is genuinely a "from your existing photos"
// path rather than a redundant camera trigger.
//
// We deliberately do NOT set the `capture` attribute on the input — that
// attribute biases iOS toward the camera by default. Without it, the system
// shows the photo library option first, which matches the user's intent
// when reaching for this control.
//
// The visible label is "From the camera roll" — verbatim from the user's
// preferred phrasing, in the editorial voice. The icon alone wouldn't be
// discoverable enough; the text earns the tap.
export function LibraryButton({ onPick, hidden, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // Reset value so picking the same file twice still fires onChange.
    e.target.value = '';
    if (f) onPick(f);
  };

  return (
    <>
      <button
        type="button"
        className={`libbtn app-chrome ${hidden ? 'is-hidden' : ''}`}
        onClick={handleClick}
        aria-label="From the camera roll"
        disabled={disabled || hidden}
      >
        <IconPhoto size={16} stroke={1.6} />
        <span className="libbtn__label">From the camera roll</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // No `capture` attribute — see component comment above.
        className="libbtn__input"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <style>{`
        .libbtn {
          position: absolute;
          left: 12px;
          /* Sit above the viewfinder's bottom chrome: the corner brackets
             at bottom: 16px (24px tall) and the fallback caption at
             bottom: 28px (single line ~20px tall, centered). 64px gives
             ~16px of comfortable breathing room above the caption rather
             than a tight 8px crammed-in gap. */
          bottom: 64px;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding: 0 14px 0 12px;
          border-radius: 999px;
          /* Glass-on-glass surface so the button rides over the viewfinder
             without obscuring the live feed underneath. */
          background: color-mix(in oklch, var(--midnight) 62%, transparent);
          backdrop-filter: blur(10px) saturate(120%);
          -webkit-backdrop-filter: blur(10px) saturate(120%);
          border: 1px solid color-mix(in oklch, var(--bone) 18%, transparent);
          color: color-mix(in oklch, var(--bone) 92%, transparent);
          font: 500 13px/1 var(--font-geist);
          letter-spacing: 0.005em;
          cursor: pointer;
          transition:
            opacity 220ms var(--ease-standard),
            transform 220ms var(--ease-standard),
            background 200ms var(--ease-standard),
            border-color 200ms var(--ease-standard),
            color 200ms var(--ease-standard);
        }
        .libbtn:hover:not(:disabled) {
          background: color-mix(in oklch, var(--midnight) 75%, transparent);
          border-color: color-mix(in oklch, var(--ember) 50%, transparent);
          color: var(--bone);
        }
        .libbtn:active:not(:disabled) {
          transform: scale(0.97);
        }
        .libbtn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .libbtn.is-hidden {
          opacity: 0;
          pointer-events: none;
          transform: translateY(4px);
        }
        .libbtn__label {
          /* On very narrow widths the label still fits, but the gap shrinks
             slightly. Keep the icon + label together so the affordance is
             always self-explanatory. */
          white-space: nowrap;
        }
        .libbtn__input {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }
      `}</style>
    </>
  );
}
