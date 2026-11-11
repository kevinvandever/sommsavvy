import type { ReactNode } from 'react';
import { IconBottle, IconGift, IconGlassFull, IconMinus, IconPlus } from '@tabler/icons-react';
import { Switch } from './Switch';
import { MAX_BOTTLES, bottlesOnHand, type Outcome } from '../lib/onHand';
import type { CellarEntry } from '../types';

interface Props {
  entry: CellarEntry;
  // Disables every control while an on-hand request is in flight, so a
  // double tap cannot remove two bottles.
  busy: boolean;
  // When set, the caption slot shows this line plus an "Undo" button.
  undoMessage: string | null;
  // Inline, under the card.
  error: string | null;
  onTurnOn: () => void;
  onCountChange: (next: number) => void;
  onOutcome: (outcome: Outcome) => void;
  onUndo: () => void;
}

// The ownership card on the entry page, under the metadata line. Placed high
// (above the AI context) so it is discoverable, not buried.
//
// Two states. While the bottle is not on hand it is today's "I have a bottle
// of this" switch. While it is on hand the switch is replaced by the count and
// the two ways a bottle leaves: "Drank it" and "Gave it away". The count's
// minus stops at 1, so from this page a bottle leaves the rack only with a
// reason (or through Undo).
export function OnHandCard({
  entry,
  busy,
  undoMessage,
  error,
  onTurnOn,
  onCountChange,
  onOutcome,
  onUndo,
}: Props) {
  const n = bottlesOnHand(entry);

  // The caption slot keeps a reserved two-line height, so swapping its text
  // or showing Undo never shifts the layout.
  const caption = (fallback: string): ReactNode => (
    <span className="onhand__caption">
      {undoMessage ? (
        <>
          {undoMessage}{' '}
          <button
            type="button"
            className="onhand__undo"
            disabled={busy}
            onClick={(e) => {
              // The off-state row is tappable as a whole; Undo must not also
              // turn the bottle on.
              e.stopPropagation();
              onUndo();
            }}
          >
            Undo
          </button>
        </>
      ) : (
        fallback
      )}
    </span>
  );

  return (
    <div className="onhand">
      {n === 0 ? (
        <div
          className="onhand__card onhand__row"
          role="presentation"
          onClick={() => {
            if (!busy) onTurnOn();
          }}
        >
          <IconBottle size={20} stroke={1.5} className="onhand__glyph" />
          <div className="onhand__text">
            <span className="onhand__label">I have a bottle of this</span>
            {caption('Mark it when you keep a bottle on hand.')}
          </div>
          <Switch
            checked={false}
            onChange={() => onTurnOn()}
            ariaLabel="I have a bottle of this"
            disabled={busy}
          />
        </div>
      ) : (
        <div className="onhand__card is-on">
          <div className="onhand__row">
            <IconBottle size={20} stroke={1.5} className="onhand__glyph" />
            <div className="onhand__text">
              <span className="onhand__label">In the rack</span>
              {caption(n === 1 ? '1 bottle on hand.' : `${n} bottles on hand.`)}
            </div>
            <div className="onhand__count">
              <button
                type="button"
                className="onhand__step"
                aria-label="One fewer bottle"
                disabled={busy || n <= 1}
                onClick={() => onCountChange(n - 1)}
              >
                <IconMinus size={16} stroke={1.8} />
              </button>
              <span className="onhand__num tnum" aria-live="polite">
                {n}
              </span>
              <button
                type="button"
                className="onhand__step"
                aria-label="One more bottle"
                disabled={busy || n >= MAX_BOTTLES}
                onClick={() => onCountChange(n + 1)}
              >
                <IconPlus size={16} stroke={1.8} />
              </button>
            </div>
          </div>
          <div className="onhand__actions">
            <button
              type="button"
              className="btn-secondary onhand__act"
              disabled={busy}
              onClick={() => onOutcome('drank')}
            >
              <IconGlassFull size={18} stroke={1.5} /> Drank it
            </button>
            <button
              type="button"
              className="btn-secondary onhand__act"
              disabled={busy}
              onClick={() => onOutcome('gave_away')}
            >
              <IconGift size={18} stroke={1.5} /> Gave it away
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="t-caption onhand__error" role="alert">
          {error}
        </p>
      )}

      <style>{`
        .onhand { margin-top: 18px; }
        .onhand__card {
          padding: 16px 18px;
          background: var(--midnight);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          -webkit-user-select: none;
          user-select: none;
          transition: border-color 200ms var(--ease-standard);
        }
        .onhand__row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        /* The off state is one tappable row, as before. */
        .onhand__card.onhand__row { cursor: pointer; }
        .onhand__card.onhand__row:hover {
          border-color: var(--border-strong);
        }
        .onhand__glyph {
          color: color-mix(in oklch, var(--bone) 55%, transparent);
          flex-shrink: 0;
          transition: color 200ms var(--ease-standard);
        }
        .onhand__card.is-on .onhand__glyph {
          color: var(--bone);
        }
        .onhand__text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          /* Reserve the two-line height so the caption swap never shifts the
             controls or the surrounding layout. */
          min-height: 38px;
          justify-content: center;
        }
        .onhand__label {
          font: 500 16px var(--font-geist);
          color: var(--parchment);
        }
        .onhand__caption {
          font: 13px var(--font-geist);
          color: color-mix(in oklch, var(--bone) 60%, transparent);
          margin-top: 2px;
        }
        .onhand__undo {
          display: inline;
          padding: 0 2px;
          font: 500 13px var(--font-geist);
          color: var(--ember);
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer;
        }
        .onhand__undo:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .onhand__count {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .onhand__step {
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-pill);
          background: var(--smoke);
          border: 1px solid var(--border-subtle);
          color: var(--bone);
          cursor: pointer;
          transition: color 180ms var(--ease-standard), border-color 180ms var(--ease-standard);
        }
        .onhand__step:hover:not(:disabled) {
          color: var(--parchment);
          border-color: color-mix(in oklch, var(--ember) 30%, var(--border-subtle));
        }
        .onhand__step:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .onhand__step:focus-visible,
        .onhand__undo:focus-visible {
          outline: 2px solid var(--ember);
          outline-offset: 2px;
        }
        .onhand__num {
          min-width: 24px;
          text-align: center;
          font: 500 17px var(--font-geist);
          color: var(--parchment);
        }
        .onhand__actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 14px;
        }
        .onhand__act {
          min-height: 44px;
          padding: 10px 12px;
          gap: 8px;
          text-align: center;
        }
        .onhand__act:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .onhand__error {
          margin-top: 8px;
          color: color-mix(in oklch, var(--bordeaux) 80%, var(--bone));
        }
      `}</style>
    </div>
  );
}
