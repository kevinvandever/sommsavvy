import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { IconGift, IconGlassFull, IconLoader2 } from '@tabler/icons-react';
import { Sheet } from './Sheet';
import { api } from '../api';
import { useStore } from '../store';
import {
  bottlesOnHand,
  outcomeItems,
  resetRow,
  rowLeft,
  rowStatus,
  stage as markBottle,
  stagedBottles,
  toRackRows,
  type Outcome,
  type RackRow,
} from '../lib/onHand';
import type { CellarEntry, OnHandSnapshot } from '../types';

type Stage = 'review' | 'saving' | 'done';

interface Result {
  applied: Array<{ id: string; entry: CellarEntry; previous: OnHandSnapshot }>;
  rejected: Array<{ id: string; reason: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const bottles = (n: number) => `${n} ${n === 1 ? 'bottle' : 'bottles'}`;

// Rack check: a stocktake of every bottle marked on hand. The user walks the
// rack against this list and taps how each missing bottle left. Marks stay
// local until Confirm, so closing early leaves the cellar untouched, and the
// commit is one request that can succeed in part. There is no Undo after
// confirming; the staging step is the safety net.
export function RackCheckSheet({ open, onClose }: Props) {
  const [, navigate] = useLocation();
  const upsertEntry = useStore((s) => s.upsertEntry);

  const [stage, setStage] = useState<Stage>('review');
  const [rows, setRows] = useState<RackRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Snapshot the on-hand entries when the sheet opens, so rows do not move
  // while the user marks them. Ignores any search query in the cellar view.
  useEffect(() => {
    if (!open) return;
    setRows(toRackRows(useStore.getState().cellar));
    setStage('review');
    setError(null);
    setResult(null);
  }, [open]);

  const update = (id: string, fn: (r: RackRow) => RackRow) =>
    setRows((rs) => rs.map((r) => (r.entry.id === id ? fn(r) : r)));

  const mark = (id: string, outcome: Outcome) => update(id, (r) => markBottle(r, outcome));

  const confirm = async () => {
    const items = outcomeItems(rows);
    if (items.length === 0) return;
    setError(null);
    setStage('saving');
    try {
      const res = await api.recordBottleOutcomes({ items, surface: 'rack_check' });
      for (const a of res.applied) upsertEntry(a.entry);
      setResult(res);
      setStage('done');
    } catch (err) {
      // A fixed message: a network failure would otherwise surface a
      // technical one. The marks are kept so a retry is one tap.
      console.error('Rack check failed', err);
      setError('Could not update the rack. Try again?');
      setStage('review');
    }
  };

  const staged = stagedBottles(rows);
  const nameOf = (id: string) => rows.find((r) => r.entry.id === id)?.entry.name ?? 'A bottle';

  return (
    <Sheet open={open} onClose={onClose} blocking={stage === 'saving'}>
      {/* --- Review --- */}
      {stage === 'review' && (
        <div className="rck">
          <h2 className="t-headline">Rack check</h2>
          <p className="t-body rck__lede">
            Everything I have on the rack. For each bottle that is gone, tap how it left. Nothing
            changes until you confirm.
          </p>

          <div className="rck__rows">
            {rows.map((r) => {
              const meta = [r.entry.producer, r.entry.vintage].filter(Boolean).join(' · ');
              const status = rowStatus(r);
              const none = rowLeft(r) === 0;
              return (
                <div key={r.entry.id} className={`rck__row ${status ? 'is-marked' : ''}`}>
                  <div className="rck__id">
                    <p className="rck__name">{r.entry.name}</p>
                    {meta && <p className="t-caption rck__meta tnum">{meta}</p>}
                    {r.onHand > 1 && <p className="t-caption rck__count tnum">{bottles(r.onHand)}</p>}
                    {status && (
                      <p className="t-caption rck__status" aria-live="polite">
                        {status}
                      </p>
                    )}
                  </div>
                  <div className="rck__btns">
                    <button
                      type="button"
                      className="btn-secondary rck__btn"
                      disabled={none}
                      onClick={() => mark(r.entry.id, 'drank')}
                      aria-label={`Drank it: ${r.entry.name}`}
                    >
                      <IconGlassFull size={16} stroke={1.5} /> Drank it
                    </button>
                    <button
                      type="button"
                      className="btn-secondary rck__btn"
                      disabled={none}
                      onClick={() => mark(r.entry.id, 'gave_away')}
                      aria-label={`Gave it away: ${r.entry.name}`}
                    >
                      <IconGift size={16} stroke={1.5} /> Gave it away
                    </button>
                    {status && (
                      <button
                        type="button"
                        className="btn-tertiary rck__reset"
                        onClick={() => update(r.entry.id, resetRow)}
                        aria-label={`Reset: ${r.entry.name}`}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <p className="t-caption rck__error" role="alert">
              {error}
            </p>
          )}
          <div className="rck__actions">
            <button className="btn-primary" onClick={() => void confirm()} disabled={staged === 0}>
              Take {bottles(staged)} off the rack
            </button>
            <button className="btn-tertiary" onClick={onClose}>
              Never mind
            </button>
          </div>
        </div>
      )}

      {/* --- Saving --- */}
      {stage === 'saving' && (
        <div className="rck rck--center">
          <IconLoader2 className="spin" size={22} />
          <p className="t-label rck__statusline">Updating the rack</p>
        </div>
      )}

      {/* --- Done --- */}
      {stage === 'done' && result && (
        <RackCheckDone
          result={result}
          drankIds={new Set(rows.filter((r) => r.drank > 0).map((r) => r.entry.id))}
          nameOf={nameOf}
          onOpen={(id) => {
            onClose();
            navigate(`/cellar/${id}`);
          }}
          onDone={onClose}
        />
      )}

      <style>{`
        .rck { display: flex; flex-direction: column; gap: 14px; }
        .rck--center { align-items: center; gap: 12px; padding: 32px 0; }
        .rck__statusline { color: color-mix(in oklch, var(--bone) 65%, transparent); }
        .rck__lede { color: var(--bone); }
        .rck__rows {
          display: flex; flex-direction: column; gap: 10px;
          max-height: 46dvh; overflow-y: auto;
          padding-right: 4px;
        }
        .rck__row {
          display: flex; flex-direction: column; gap: 10px;
          padding: 12px;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          background: color-mix(in oklch, var(--midnight) 35%, transparent);
          transition: border-color 180ms var(--ease-standard);
        }
        .rck__row.is-marked {
          border-color: color-mix(in oklch, var(--ember) 35%, var(--border-subtle));
        }
        .rck__id { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .rck__name {
          font: 500 15px/1.3 var(--font-geist);
          color: var(--parchment);
          margin: 0;
        }
        .rck__meta, .rck__count { margin: 0; }
        .rck__status {
          margin: 2px 0 0;
          color: var(--ember);
        }
        .rck__btns { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .rck__btn {
          min-height: 44px;
          padding: 8px 14px;
          gap: 6px;
          font-size: 13px;
        }
        .rck__btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .rck__reset { padding: 8px 10px; font-size: 13px; }
        .rck__error {
          color: color-mix(in oklch, var(--bordeaux) 80%, var(--bone));
        }
        .rck__actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
        .rck__drank { display: flex; flex-direction: column; gap: 6px; }
        .rck__open {
          align-self: flex-start;
          padding: 6px 0;
          text-align: left;
          color: var(--parchment);
          font: 500 15px var(--font-geist);
          text-decoration: underline;
          text-decoration-color: color-mix(in oklch, var(--ember) 50%, transparent);
          text-underline-offset: 3px;
          cursor: pointer;
        }
        .rck__open:hover { color: var(--ember); }
        .rck__rejected {
          padding: 10px 12px;
          border-radius: var(--radius-md);
          background: color-mix(in oklch, var(--bordeaux) 10%, var(--midnight));
          border: 1px solid color-mix(in oklch, var(--bordeaux) 25%, var(--border-subtle));
          display: flex; flex-direction: column; gap: 3px;
        }
      `}</style>
    </Sheet>
  );
}

function RackCheckDone({
  result,
  drankIds,
  nameOf,
  onOpen,
  onDone,
}: {
  result: Result;
  drankIds: Set<string>;
  nameOf: (id: string) => string;
  onOpen: (id: string) => void;
  onDone: () => void;
}) {
  const { applied, rejected } = result;
  const headline =
    applied.length === 0 ? 'Nothing changed.' : rejected.length > 0 ? 'Mostly current.' : 'The rack is current.';
  const removed = applied.reduce((sum, a) => sum + a.previous.bottleCount - bottlesOnHand(a.entry), 0);
  const drank = applied.filter((a) => drankIds.has(a.id));

  return (
    <div className="rck">
      <h2 className="t-headline">{headline}</h2>
      {applied.length > 0 && <p className="t-body rck__lede">{bottles(removed)} off the rack.</p>}

      {drank.length > 0 && (
        <div className="rck__drank">
          <p className="t-caption">You drank these. Tap one to add a note.</p>
          {drank.map((a) => (
            <button key={a.id} type="button" className="rck__open" onClick={() => onOpen(a.id)}>
              {a.entry.name}
            </button>
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="rck__rejected">
          <p className="t-label">Could not update {rejected.length}:</p>
          {rejected.map((r, i) => (
            <p key={`${r.id}-${i}`} className="t-caption">
              {nameOf(r.id)}: {r.reason}
            </p>
          ))}
        </div>
      )}

      <div className="rck__actions">
        <button className="btn-primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
