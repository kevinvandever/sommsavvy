import { useEffect, useRef, useState } from 'react';

interface Props {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
  errored?: boolean;
}

// Six-digit verification code input. Auto-advance, paste-fills-all,
// Ember-flash-on-fill, backspace-clears-prev. Auto-fires onComplete when
// all digits are entered.
export function DigitBoxes({ length = 6, onComplete, disabled, errored }: Props) {
  const [values, setValues] = useState<string[]>(() => Array(length).fill(''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // Focus first box on mount.
  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 360);
    return () => clearTimeout(t);
  }, []);

  // Reset values if errored is toggled (so user can retry).
  useEffect(() => {
    if (errored) {
      setValues(Array(length).fill(''));
      refs.current[0]?.focus();
    }
  }, [errored, length]);

  const handleChange = (i: number, v: string) => {
    if (disabled) return;
    const digit = v.replace(/\D/g, '').slice(-1);
    setValues((prev) => {
      const next = [...prev];
      next[i] = digit;
      // Auto-advance if a digit was entered.
      if (digit && i < length - 1) {
        setTimeout(() => refs.current[i + 1]?.focus(), 0);
      }
      // If complete, fire callback.
      if (next.every((d) => d.length === 1)) {
        const code = next.join('');
        setTimeout(() => onComplete(code), 200);
      }
      return next;
    });
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !values[i] && i > 0) {
      e.preventDefault();
      setValues((prev) => {
        const next = [...prev];
        next[i - 1] = '';
        return next;
      });
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(length)
      .fill('')
      .map((_, i) => pasted[i] || '');
    setValues(next);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
    if (next.every((d) => d.length === 1)) {
      setTimeout(() => onComplete(next.join('')), 240);
    }
  };

  return (
    <div className="dboxes" role="group" aria-label="Verification code">
      {values.map((v, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`dbox ${v ? 'is-filled' : ''} ${errored ? 'is-errored' : ''} ${disabled ? 'is-loading' : ''}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={v}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
        />
      ))}

      <style>{`
        .dboxes {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin: 8px 0;
        }
        .dbox {
          width: 48px;
          height: 56px;
          border-radius: var(--radius-md);
          background: var(--smoke);
          color: var(--parchment);
          border: 1px solid var(--border-subtle);
          text-align: center;
          font: 500 28px var(--font-rowan);
          caret-color: var(--ember);
          transition:
            border-color 220ms var(--ease-standard),
            background 220ms var(--ease-standard),
            transform 200ms var(--ease-standard),
            box-shadow 220ms var(--ease-standard);
        }
        @media (max-width: 380px) {
          .dbox { width: 42px; height: 50px; font-size: 24px; }
          .dboxes { gap: 8px; }
        }
        .dbox:focus, .dbox:focus-visible {
          outline: none;
          border-color: var(--ember);
          background: color-mix(in oklch, var(--smoke) 90%, var(--ember));
          box-shadow: 0 0 16px color-mix(in oklch, var(--ember) 25%, transparent);
        }
        .dbox.is-filled {
          border-color: var(--border-strong);
          animation: dbox-pop 220ms var(--ease-entrance);
        }
        .dbox.is-errored {
          border-color: var(--bordeaux);
          animation: dbox-shake 360ms ease-in-out;
        }
        .dbox.is-loading {
          animation: dbox-pulse 1.4s ease-in-out infinite;
        }
        @keyframes dbox-pop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.06); border-color: var(--ember); }
          100% { transform: scale(1); }
        }
        @keyframes dbox-shake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-3px); }
          50%      { transform: translateX(3px); }
          75%      { transform: translateX(-2px); }
        }
        @keyframes dbox-pulse {
          0%, 100% { border-color: color-mix(in oklch, var(--ember) 40%, transparent); }
          50%      { border-color: var(--ember); }
        }
      `}</style>
    </div>
  );
}
