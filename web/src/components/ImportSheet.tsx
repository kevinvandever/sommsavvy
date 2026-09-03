import { useRef, useState } from 'react';
import { IconCamera, IconLoader2 } from '@tabler/icons-react';
import { Sheet } from './Sheet';
import { api, type ParsedItem } from '../api';
import { uploadImage } from '../lib/upload';
import { useStore } from '../store';
import type { CellarEntry, Kind } from '../types';

const KINDS: Kind[] = ['wine', 'beer', 'spirits'];
const CURRENT_YEAR = new Date().getFullYear();

// One editable row in the review list. Local to this sheet until commit.
interface Row {
  include: boolean;
  name: string;
  producer: string;
  region: string;
  vintageRaw: string;
  kind: Kind;
  confidence: ParsedItem['confidence'];
  error?: string;
}

function toRow(item: ParsedItem): Row {
  return {
    include: true,
    name: item.name,
    producer: item.producer ?? '',
    region: item.region ?? '',
    vintageRaw: item.vintage != null ? String(item.vintage) : '',
    kind: item.kind,
    confidence: item.confidence,
  };
}

type Stage = 'pick' | 'parsing' | 'review' | 'saving' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Bulk import: photograph a shipment list, review what was read, commit the
// confirmed rows as bottles you have on hand but have not tasted. Nothing is
// written until Commit, so backing out leaves the cellar untouched.
export function ImportSheet({ open, onClose }: Props) {
  const upsertEntry = useStore((s) => s.upsertEntry);

  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [rejected, setRejected] = useState<Array<{ index: number; reason: string }>>([]);
  // Held so a failed upload can be retried without re-picking the file.
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const reset = () => {
    setStage('pick');
    setError(null);
    setRows([]);
    setTruncated(false);
    setSavedCount(0);
    setRejected([]);
    setPendingFile(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const runParse = async (file: File) => {
    setError(null);
    setPendingFile(file);
    setStage('parsing');
    try {
      const url = await uploadImage(file);
      const { items, truncated: tr } = await api.parseCellarDocument({ imageUrl: url });
      if (items.length === 0) {
        setError('Could not find any bottles on that. Try a clearer photo, or add one by hand.');
        setStage('pick');
        return;
      }
      setRows(items.map(toRow));
      setTruncated(tr);
      setStage('review');
    } catch (err) {
      // Upload or parse failed. Keep the picked file so retry is one tap, and
      // make no further calls.
      const msg = err instanceof Error ? err.message : 'That did not come through. One more try?';
      setError(msg);
      setStage('pick');
    }
  };

  const patch = (i: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p, error: undefined } : r)));

  const commit = async () => {
    const included = rows.filter((r) => r.include);
    if (included.length === 0) {
      setError('Nothing selected to add.');
      return;
    }

    // Validate locally first so bad rows are flagged in place, not lost.
    let hasError = false;
    const validated = rows.map((r) => {
      if (!r.include) return r;
      if (!r.name.trim()) {
        hasError = true;
        return { ...r, error: 'A name is needed.' };
      }
      if (r.vintageRaw) {
        const n = Number(r.vintageRaw);
        if (!Number.isFinite(n) || n < 1900 || n > CURRENT_YEAR + 1) {
          hasError = true;
          return { ...r, error: 'That vintage seems off.' };
        }
      }
      return { ...r, error: undefined };
    });
    if (hasError) {
      setRows(validated);
      return;
    }

    setError(null);
    setStage('saving');
    try {
      const { saved, rejected: rej } = await api.saveCellarEntriesBulk({
        entries: included.map((r) => ({
          name: r.name.trim(),
          kind: r.kind,
          producer: r.producer.trim() || undefined,
          region: r.region.trim() || undefined,
          vintage: r.vintageRaw ? Number(r.vintageRaw) : undefined,
        })),
      });
      for (const entry of saved as CellarEntry[]) upsertEntry(entry);
      setSavedCount(saved.length);
      setRejected(rej);
      setStage('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not add those. Try again?';
      setError(msg);
      setStage('review');
    }
  };

  const includedCount = rows.filter((r) => r.include).length;

  return (
    <Sheet open={open} onClose={close}>
      {/* --- Pick --- */}
      {stage === 'pick' && (
        <div className="imp">
          <h2 className="t-headline">Add a shipment</h2>
          <p className="t-body imp__lede">
            Photograph the packing list and I will read the bottles off it. You get to check my
            work before anything lands in your cellar.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="imp__file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runParse(f);
              e.target.value = '';
            }}
          />
          <button className="btn-primary imp__pick" onClick={() => fileRef.current?.click()}>
            <IconCamera size={18} stroke={1.6} /> Choose a photo
          </button>
          {pendingFile && error && (
            <button className="btn-tertiary" onClick={() => void runParse(pendingFile)}>
              Try that photo again
            </button>
          )}
          {error && <p className="imp__error t-caption">{error}</p>}
          <p className="t-caption imp__note">
            These go in as bottles you have on hand, not yet tasted, so your taste profile stays
            about what you have actually drunk.
          </p>
        </div>
      )}

      {/* --- Parsing --- */}
      {stage === 'parsing' && (
        <div className="imp imp--center">
          <IconLoader2 className="spin" size={22} />
          <p className="t-label imp__status">Reading the list</p>
        </div>
      )}

      {/* --- Review --- */}
      {stage === 'review' && (
        <div className="imp">
          <h2 className="t-headline">Check my work</h2>
          <p className="t-body imp__lede">
            {rows.length} {rows.length === 1 ? 'bottle' : 'bottles'} found. Fix anything I misread,
            uncheck what you do not want.
          </p>
          {truncated && (
            <p className="t-caption imp__note">
              That list was long, so I stopped at {rows.length}. Run it again for the rest.
            </p>
          )}

          <div className="imp__rows">
            {rows.map((r, i) => (
              <div key={i} className={`imp__row ${r.include ? '' : 'is-out'}`}>
                <label className="imp__check">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => patch(i, { include: e.target.checked })}
                    aria-label={`Include ${r.name || 'this bottle'}`}
                  />
                </label>
                <div className="imp__fields">
                  <input
                    className={`imp__input imp__input--name ${r.error ? 'is-error' : ''}`}
                    value={r.name}
                    onChange={(e) => patch(i, { name: e.target.value.slice(0, 200) })}
                    placeholder="Name"
                    aria-label="Name"
                  />
                  <div className="imp__meta-row">
                    <input
                      className="imp__input"
                      value={r.producer}
                      onChange={(e) => patch(i, { producer: e.target.value.slice(0, 200) })}
                      placeholder="Producer"
                      aria-label="Producer"
                    />
                    <input
                      className="imp__input imp__input--year tnum"
                      inputMode="numeric"
                      value={r.vintageRaw}
                      onChange={(e) =>
                        patch(i, { vintageRaw: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })
                      }
                      placeholder="Year"
                      aria-label="Vintage year"
                    />
                  </div>
                  <div className="imp__kinds" role="radiogroup" aria-label="Type">
                    {KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={r.kind === k}
                        className={`imp__kind ${r.kind === k ? 'is-active' : ''}`}
                        onClick={() => patch(i, { kind: k })}
                      >
                        {k}
                      </button>
                    ))}
                    {r.confidence === 'low' && (
                      <span className="imp__low" title="Read with low confidence">
                        worth a look
                      </span>
                    )}
                  </div>
                  {r.error && <p className="imp__error t-caption">{r.error}</p>}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="imp__error t-caption">{error}</p>}
          <div className="imp__actions">
            <button className="btn-primary" onClick={() => void commit()} disabled={includedCount === 0}>
              Add {includedCount} to cellar
            </button>
            <button className="btn-tertiary" onClick={close}>
              Never mind
            </button>
          </div>
        </div>
      )}

      {/* --- Saving --- */}
      {stage === 'saving' && (
        <div className="imp imp--center">
          <IconLoader2 className="spin" size={22} />
          <p className="t-label imp__status">Adding to your cellar</p>
        </div>
      )}

      {/* --- Done --- */}
      {stage === 'done' && (
        <div className="imp">
          <h2 className="t-headline">
            {savedCount} {savedCount === 1 ? 'bottle' : 'bottles'} in the rack.
          </h2>
          <p className="t-body imp__lede">
            They are marked as on hand and not yet tasted. Mark one tasted when you open it and it
            starts shaping your profile.
          </p>
          {rejected.length > 0 && (
            <div className="imp__rejected">
              <p className="t-label">Could not add {rejected.length}:</p>
              {rejected.map((r) => (
                <p key={r.index} className="t-caption">
                  Row {r.index + 1}: {r.reason}
                </p>
              ))}
            </div>
          )}
          <div className="imp__actions">
            <button className="btn-primary" onClick={close}>
              Done
            </button>
            <button className="btn-tertiary" onClick={reset}>
              Add another list
            </button>
          </div>
        </div>
      )}

      <style>{`
        .imp { display: flex; flex-direction: column; gap: 14px; }
        .imp--center { align-items: center; gap: 12px; padding: 32px 0; }
        .imp__status { color: color-mix(in oklch, var(--bone) 65%, transparent); }
        .imp__lede { color: var(--bone); }
        .imp__note {
          color: color-mix(in oklch, var(--bone) 55%, transparent);
        }
        .imp__file { display: none; }
        .imp__pick { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; }
        .imp__error {
          color: color-mix(in oklch, var(--bordeaux) 80%, var(--bone));
        }
        .imp__rows {
          display: flex; flex-direction: column; gap: 10px;
          max-height: 46dvh; overflow-y: auto;
          padding-right: 4px;
        }
        .imp__row {
          display: flex; gap: 10px; align-items: flex-start;
          padding: 10px;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          background: color-mix(in oklch, var(--midnight) 35%, transparent);
          transition: opacity 180ms var(--ease-standard);
        }
        .imp__row.is-out { opacity: 0.45; }
        .imp__check { padding-top: 6px; }
        .imp__fields { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .imp__meta-row { display: flex; gap: 6px; }
        .imp__input {
          background: transparent;
          border: 1px solid transparent;
          border-radius: var(--radius-sm, 6px);
          padding: 5px 7px;
          color: var(--bone);
          width: 100%;
          font-size: 14px;
          transition: border-color 160ms var(--ease-standard);
        }
        .imp__input:hover { border-color: var(--border-subtle); }
        .imp__input:focus {
          outline: none;
          border-color: var(--ember);
          background: color-mix(in oklch, var(--smoke) 80%, var(--midnight));
        }
        .imp__input::placeholder { color: color-mix(in oklch, var(--bone) 35%, transparent); }
        .imp__input.is-error { border-color: color-mix(in oklch, var(--bordeaux) 70%, var(--bone)); }
        .imp__input--name { font-weight: 500; font-size: 15px; }
        .imp__input--year { max-width: 78px; flex: 0 0 auto; }
        .imp__kinds { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .imp__kind {
          padding: 3px 10px;
          font-size: 11px;
          text-transform: capitalize;
          color: color-mix(in oklch, var(--bone) 65%, transparent);
          background: transparent;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-pill, 999px);
          cursor: pointer;
        }
        .imp__kind.is-active {
          color: var(--bone);
          background: color-mix(in oklch, var(--ember) 15%, var(--smoke));
          border-color: color-mix(in oklch, var(--ember) 40%, var(--border-subtle));
        }
        .imp__low {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ember);
          margin-left: 2px;
        }
        .imp__actions { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
        .imp__rejected {
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
