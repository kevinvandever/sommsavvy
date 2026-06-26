import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'motion/react';
import { IconRefresh, IconArrowLeft } from '@tabler/icons-react';
import { Header } from '../components/Header';
import { Atmosphere } from '../components/Atmosphere';
import { ResultCard } from '../components/ResultCard';
import { ScanCard } from '../components/ScanCard';
import { AuthSheet } from '../components/AuthSheet';
import { useStore } from '../store';
import { api } from '../api';
import type { Recommendation, ScanResult } from '../types';
import { EASE, DUR } from '../lib/motion';

export function Result() {
  const [, navigate] = useLocation();
  const pocketSommResult = useStore((s) => s.pocketSommResult);
  const scanResult = useStore((s) => s.scanResult);
  const capturedImageUrl = useStore((s) => s.capturedImageUrl);
  const user = useStore((s) => s.user);
  const upsertEntry = useStore((s) => s.upsertEntry);
  const pendingSave = useStore((s) => s.pendingSave);
  const setPendingSave = useStore((s) => s.setPendingSave);

  const [authOpen, setAuthOpen] = useState(false);
  const [pendingThumb, setPendingThumb] = useState<string | undefined>(undefined);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [scanSaved, setScanSaved] = useState(false);
  // Map from card key (rec.name or scanResult.name) → saved cellar entry id.
  // Lets the per-card "Add a note" link find its row in the cellar.
  const [savedEntryIds, setSavedEntryIds] = useState<Record<string, string>>({});

  // No result: shouldn't happen, but bounce home.
  if (!pocketSommResult && !scanResult) {
    navigate('/');
    return null;
  }

  // Build a save payload from a recommendation.
  const buildPayload = (r: Recommendation) => ({
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

  const buildScanPayload = (s: ScanResult) => ({
    kind: s.kind,
    name: s.name,
    producer: s.producer || undefined,
    region: s.region || undefined,
    vintage: s.vintage || undefined,
    abv: s.abv || undefined,
    photoUrl: s.photoUrl || capturedImageUrl || undefined,
    source: 'scan' as const,
    whyText: s.expect,
    monocleAside: s.monocleAside || undefined,
    pairings: s.pairings,
    occasion: s.occasion,
    valueNote: s.valueNote,
  });

  // Save flow: if signed in, fire immediately and return the entry id so
  // the calling card can attach a note to it. Otherwise stash, open auth,
  // and return void — the saved id will arrive on the auth-success path
  // below and feed back to the card via savedEntryIds.
  type SavePayload = Parameters<typeof api.saveCellarEntry>[0];
  const trySave = async (
    payload: SavePayload,
    key: string,
    thumb?: string,
  ): Promise<string | void> => {
    if (!user) {
      setPendingSave({ payload });
      setPendingThumb(thumb);
      setAuthOpen(true);
      return;
    }
    const { entry } = await api.saveCellarEntry(payload);
    upsertEntry(entry);
    setSavedIds((s) => new Set([...s, key]));
    setSavedEntryIds((m) => ({ ...m, [key]: entry.id }));
    return entry.id;
  };

  // After auth completes, the App-level effect re-fires the pending save. We
  // also set the saved local state here so the pill goes Verde immediately.
  const onAuthSuccess = async () => {
    if (!pendingSave) return;
    try {
      const { entry } = await api.saveCellarEntry(pendingSave.payload);
      upsertEntry(entry);
      // We can't easily map back to which card it was, but set scanSaved if
      // it matches scan result, otherwise mark the matching rec by name.
      const key = pendingSave.payload.name;
      if (scanResult && key === scanResult.name) {
        setScanSaved(true);
      } else if (pocketSommResult) {
        setSavedIds((s) => {
          const n = new Set(s);
          n.add(key);
          return n;
        });
      }
      // Record the entry id keyed by name so the card's "Add a note" link
      // can attach a note to the newly saved row.
      setSavedEntryIds((m) => ({ ...m, [key]: entry.id }));
    } finally {
      setPendingSave(null);
    }
  };

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
          <button className="result__back btn-tertiary" onClick={() => navigate('/')}>
            <IconArrowLeft size={16} stroke={1.6} /> Back to camera
          </button>

          {pocketSommResult && (
            <>
              {pocketSommResult.summary && (
                <p className="result__summary t-display t-display--italic">
                  {pocketSommResult.summary}
                </p>
              )}
              <div className="result__stack">
                {pocketSommResult.recommendations.map((rec, i) => (
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

          {scanResult && (
            <div className="result__stack">
              <ScanCard
                result={scanResult}
                capturedDataUrl={capturedImageUrl}
                saved={scanSaved}
                savedEntryId={savedEntryIds[scanResult.name]}
                onSave={() => trySave(buildScanPayload(scanResult), scanResult.name, scanResult.photoUrl)}
              />
            </div>
          )}

          <button className="btn-tertiary result__try-again" onClick={() => navigate('/')}>
            <IconRefresh size={18} stroke={1.6} /> Try again
          </button>
        </motion.main>

        <AuthSheet
          open={authOpen}
          onClose={() => setAuthOpen(false)}
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
      `}</style>
    </div>
  );
}
