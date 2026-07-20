import { useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'motion/react';
import { IconRefresh, IconArrowLeft, IconAlertTriangle } from '@tabler/icons-react';
import { Header } from '../components/Header';
import { Atmosphere } from '../components/Atmosphere';
import { ResultCard } from '../components/ResultCard';
import { ScanCard, type EditedIdentity } from '../components/ScanCard';
import { AuthSheet } from '../components/AuthSheet';
import { OverrideAction } from '../components/OverrideAction';
import { useStore } from '../store';
import { api, SignInRequiredError } from '../api';
import type { PocketSommOutput, ScanResult } from '../types';
import { EASE, DUR } from '../lib/motion';

export function Result() {
  const [, navigate] = useLocation();
  const resultMode = useStore((s) => s.resultMode);
  const result = useStore((s) => s.result);
  const ambiguous = useStore((s) => s.ambiguous);
  const confidence = useStore((s) => s.confidence);
  const session = useStore((s) => s.session);
  const user = useStore((s) => s.user);
  const upsertEntry = useStore((s) => s.upsertEntry);
  const pendingSave = useStore((s) => s.pendingSave);
  const setPendingSave = useStore((s) => s.setPendingSave);

  const setRouting = useStore((s) => s.setRouting);
  const setResult = useStore((s) => s.setResult);
  const clearScan = useStore((s) => s.clearScan);
  const depth = useStore((s) => s.depth);

  const [authOpen, setAuthOpen] = useState(false);
  const [pendingThumb, setPendingThumb] = useState<string | undefined>(undefined);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [scanSaved, setScanSaved] = useState(false);
  const [savedEntryIds, setSavedEntryIds] = useState<Record<string, string>>({});
  const [overriding, setOverriding] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // No resultMode means the user navigated directly to /result. Redirect home.
  if (!resultMode) {
    navigate('/');
    return null;
  }

  // Narrow the result to its typed shape based on resultMode.
  const scanResult = resultMode === 'identify' ? (result as ScanResult | null) : null;
  const pairResult = resultMode === 'pair' ? (result as PocketSommOutput | null) : null;

  // Build a save payload from a recommendation (pair mode).
  const buildPayload = (r: PocketSommOutput['recommendations'][number]) => ({
    kind: r.kind,
    name: r.name,
    producer: r.producer || undefined,
    region: r.region || undefined,
    vintage: r.vintage || undefined,
    abv: r.abv || undefined,
    photoUrl: r.photoUrl,
    source: 'somm' as const,
    whyText: r.why,
    monocleAside: r.monocleAside || undefined,
    pairings: r.pairings,
  });

  const buildScanPayload = (s: ScanResult, edited?: EditedIdentity) => ({
    kind: edited?.kind ?? s.kind,
    name: edited?.name ?? s.name,
    producer: edited?.producer || s.producer || undefined,
    region: edited?.region || s.region || undefined,
    vintage: edited?.vintage ?? s.vintage ?? undefined,
    abv: s.abv || undefined,
    photoUrl: s.photoUrl || session?.imageUrl || undefined,
    source: 'scan' as const,
    whyText: s.expect,
    monocleAside: s.monocleAside || undefined,
    pairings: s.pairings,
    occasion: s.occasion,
    valueNote: s.valueNote,
  });

  type SavePayload = Parameters<typeof api.saveCellarEntry>[0];
  const trySave = async (
    payload: SavePayload,
    key: string,
    thumb?: string,
  ): Promise<string | void> => {
    // If we already know the user is anonymous, short-circuit to auth.
    if (!user) {
      setPendingSave({ payload });
      setPendingThumb(thumb);
      setAuthOpen(true);
      return;
    }
    try {
      const { entry } = await api.saveCellarEntry(payload);
      upsertEntry(entry);
      setSavedIds((s) => new Set([...s, key]));
      setSavedEntryIds((m) => ({ ...m, [key]: entry.id }));
      return entry.id;
    } catch (err) {
      // Token expired or server returned 401 — treat as sign_in_required.
      if (err instanceof SignInRequiredError) {
        setPendingSave({ payload });
        setPendingThumb(thumb);
        setAuthOpen(true);
        return;
      }
      throw err;
    }
  };

  // After auth completes, replay the pending save exactly once.
  const onAuthSuccess = async () => {
    if (!pendingSave) return;
    try {
      const { entry } = await api.saveCellarEntry(pendingSave.payload);
      upsertEntry(entry);
      // Mark as saved. For scan mode, set scanSaved directly so the card
      // shows the saved state regardless of name edits.
      if (resultMode === 'identify') {
        setScanSaved(true);
      } else {
        const key = pendingSave.payload.name;
        setSavedIds((s) => {
          const n = new Set(s);
          n.add(key);
          return n;
        });
      }
      setSavedEntryIds((m) => ({ ...m, [pendingSave.payload.name]: entry.id }));
    } finally {
      setPendingSave(null);
    }
  };

  // Handle stream errors: CONTEXT_EXPIRED routes to Home; generic errors
  // show a friendly message on this surface with navigation intact.
  const handleStreamError = useCallback(
    (err: { message: string; code?: string }) => {
      if (err.code === 'CONTEXT_EXPIRED') {
        clearScan();
        navigate('/?notice=capture-again');
        return;
      }
      setStreamError('Something went sideways. Try scanning again.');
      setOverriding(false);
    },
    [navigate, clearScan],
  );

  // Override: re-call smartScan with forceMode using the current session.
  const runOverride = useCallback(
    async (target: 'identify' | 'pair') => {
      // No session context available — navigate to Home with a notice.
      if (!session?.imageUrl && !session?.text) {
        clearScan();
        navigate('/?notice=capture-again');
        return;
      }

      setStreamError(null);
      setOverriding(true);

      try {
        await api.smartScan(
          { imageUrl: session.imageUrl, text: session.text, depth, forceMode: target },
          {
            onRouting: (meta) => {
              setRouting(meta);
            },
            onResult: (res) => {
              setRouting({ mode: res.mode, ambiguous: res.ambiguous, confidence: res.confidence });
              setResult(res.data);
              setOverriding(false);
            },
            onError: handleStreamError,
          },
        );
      } catch {
        // Network-level or pre-stream failure.
        setStreamError('Something went sideways. Try scanning again.');
        setOverriding(false);
      }
    },
    [session, depth, setRouting, setResult, clearScan, handleStreamError, navigate],
  );

  return (
    <div className="canvas">
      <Atmosphere />
      <div className="ember-room" aria-hidden="true" />
      <div className="app-shell">
        <Header />

        <motion.main
          className="result"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.std, ease: EASE.standard }}
        >
          <button className="result__back btn-tertiary" onClick={() => { clearScan(); navigate('/'); }}>
            <IconArrowLeft size={16} stroke={1.6} /> Back to camera
          </button>

          {/* Override action: one per surface, prominent when ambiguous */}
          {resultMode === 'identify' && (
            <OverrideAction
              label="Pair this instead"
              ambiguous={ambiguous}
              onOverride={() => runOverride('pair')}
            />
          )}
          {resultMode === 'pair' && (
            <OverrideAction
              label="Identify and save"
              ambiguous={ambiguous}
              onOverride={() => runOverride('identify')}
            />
          )}

          {/* Override loading state */}
          {overriding && (
            <div className="result__loading">
              <p className="t-label result__loading-text">Switching lanes</p>
              <div className="result__skeleton-stack">
                <div className="result__skeleton-card" />
              </div>
            </div>
          )}

          {/* Stream error: friendly message, no technical details */}
          {streamError && !overriding && (
            <div className="result__error" role="alert">
              <IconAlertTriangle size={20} stroke={1.6} />
              <p className="t-body">{streamError}</p>
            </div>
          )}

          {/* Pair mode: render ResultCard for each recommendation */}
          {!overriding && resultMode === 'pair' && pairResult && (
            <>
              {pairResult.summary && (
                <p className="result__summary t-display t-display--italic">
                  {pairResult.summary}
                </p>
              )}
              <div className="result__stack">
                {pairResult.recommendations.map((rec, i) => (
                  <ResultCard
                    key={`${rec.name}-${i}`}
                    rec={rec}
                    index={i}
                    isFirst={i === 0}
                    saved={savedIds.has(rec.name)}
                    savedEntryId={savedEntryIds[rec.name]}
                    onSave={() => trySave(buildPayload(rec), rec.name, rec.photoUrl)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Pair mode: loading skeleton while waiting for data */}
          {!overriding && resultMode === 'pair' && !pairResult && (
            <div className="result__loading">
              <p className="t-label result__loading-text">Finding pairings</p>
              <div className="result__skeleton-stack">
                <div className="result__skeleton-card" />
                <div className="result__skeleton-card" />
              </div>
            </div>
          )}

          {/* Identify mode: render ScanCard */}
          {!overriding && resultMode === 'identify' && scanResult && (
            <div className="result__stack">
              <ScanCard
                result={scanResult}
                capturedDataUrl={session?.imageUrl ?? null}
                saved={scanSaved}
                savedEntryId={savedEntryIds[scanResult.name]}
                onSave={(edited) =>
                  trySave(buildScanPayload(scanResult, edited), scanResult.name, scanResult.photoUrl)
                }
              />
            </div>
          )}

          {/* Identify mode: loading skeleton while waiting for data */}
          {!overriding && resultMode === 'identify' && !scanResult && (
            <div className="result__loading">
              <p className="t-label result__loading-text">Identifying</p>
              <div className="result__skeleton-stack">
                <div className="result__skeleton-card result__skeleton-card--tall" />
              </div>
            </div>
          )}

          <button className="btn-tertiary result__try-again" onClick={() => { clearScan(); navigate('/'); }}>
            <IconRefresh size={18} stroke={1.6} /> Try again
          </button>
        </motion.main>

        <AuthSheet
          open={authOpen}
          onClose={() => {
            setAuthOpen(false);
            // Cancel: discard pendingSave without calling save.
            setPendingSave(null);
          }}
          bottleThumbnailUrl={pendingThumb}
          onSuccess={onAuthSuccess}
        />
      </div>

      <style>{`
        .result {
          flex: 1;
          padding: 8px 16px 64px;
          max-width: 720px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        @media (min-width: 760px) {
          .result { padding: 16px 32px 80px; }
        }
        .result__back {
          align-self: flex-start;
          padding-left: 0;
        }
        .result__summary {
          text-align: center;
          font-size: clamp(22px, 4.5vw, 30px);
          color: var(--bone);
          padding: 8px 16px 16px;
          line-height: 1.2;
        }
        .result__stack {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .result__try-again {
          align-self: center;
          margin-top: 16px;
        }
        .result__try-again:hover svg { transform: rotate(-30deg); transition: transform 280ms var(--ease-standard); }
        .result__loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 40px 16px;
        }
        .result__loading-text {
          color: color-mix(in oklch, var(--bone) 60%, transparent);
          animation: result-pulse 2s ease-in-out infinite;
        }
        @keyframes result-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .result__skeleton-stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }
        .result__skeleton-card {
          background: color-mix(in oklch, var(--smoke) 80%, var(--midnight));
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          height: 200px;
          animation: result-pulse 2s ease-in-out infinite;
        }
        .result__skeleton-card--tall {
          height: 360px;
        }
        .result__error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 16px 20px;
          background: color-mix(in oklch, var(--bordeaux) 12%, var(--midnight));
          border: 1px solid color-mix(in oklch, var(--bordeaux) 30%, var(--border-subtle));
          border-radius: var(--radius-lg);
          color: color-mix(in oklch, var(--bordeaux) 80%, var(--bone));
        }
        .result__error .t-body {
          margin: 0;
          font-size: 15px;
          line-height: 1.4;
        }
        .result__error svg {
          flex-shrink: 0;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
