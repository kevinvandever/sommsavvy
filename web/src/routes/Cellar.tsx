import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'motion/react';
import { IconArrowLeft, IconSearch } from '@tabler/icons-react';
import { Header } from '../components/Header';
import { Atmosphere } from '../components/Atmosphere';
import { CellarMosaic } from '../components/CellarMosaic';
import { AuthSheet } from '../components/AuthSheet';
import { useStore } from '../store';
import { api } from '../api';
import { img } from '../lib/cdn';
import { EASE, DUR } from '../lib/motion';
import type { CellarEntry, Kind } from '../types';

// Boot-time placeholder. Reserves the visual space the mosaic will take so
// that switching from "loading" to "loaded" doesn't shift layout.
function CellarSkeleton() {
  return (
    <div className="cellar__skel" aria-hidden="true">
      <div className="cellar__skel-title" />
      <div className="cellar__skel-chips">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="cellar__skel-chip" />
        ))}
      </div>
      <div className="cellar__skel-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="cellar__skel-tile" />
        ))}
      </div>
      <style>{`
        .cellar__skel { padding-top: 8px; }
        .cellar__skel-title {
          height: 32px;
          width: 220px;
          margin-bottom: 24px;
          border-radius: 8px;
          background: color-mix(in oklch, var(--bone) 6%, transparent);
          animation: cellar-skel-pulse 2s ease-in-out infinite;
        }
        .cellar__skel-chips {
          display: flex; gap: 8px; flex-wrap: wrap;
          margin-bottom: 24px;
        }
        .cellar__skel-chip {
          height: 30px; width: 70px;
          border-radius: 999px;
          background: color-mix(in oklch, var(--bone) 5%, transparent);
          animation: cellar-skel-pulse 2s ease-in-out infinite;
        }
        .cellar__skel-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (min-width: 600px) { .cellar__skel-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 900px) { .cellar__skel-grid { grid-template-columns: repeat(4, 1fr); } }
        .cellar__skel-tile {
          aspect-ratio: 4 / 5;
          border-radius: var(--radius-md);
          background: color-mix(in oklch, var(--bone) 5%, transparent);
          animation: cellar-skel-pulse 2.4s ease-in-out infinite;
        }
        .cellar__skel-tile:nth-child(2n) { animation-delay: 0.2s; }
        .cellar__skel-tile:nth-child(3n) { animation-delay: 0.4s; }
        @keyframes cellar-skel-pulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Empty-cellar state: hero photo + invite to start with the camera.
// The signed-in user has not saved anything yet.
function EmptyCellar({ onCameraOpen }: { onCameraOpen: () => void }) {
  return (
    <div className="cellar__empty">
      <div className="cellar__hero-wrap">
        <img className="cellar__hero" src={img(EMPTY_HERO, 1200) || EMPTY_HERO} alt="" />
        <div className="cellar__hero-grad" aria-hidden="true" />
      </div>
      <div className="cellar__empty-copy">
        <h1 className="t-display">Your cellar is quiet.</h1>
        <p className="t-body">Open the camera and tell me about the last good thing you drank. The first save is the start of your taste profile.</p>
        <div className="cellar__empty-actions">
          <button className="btn-primary" onClick={onCameraOpen}>
            Open camera
          </button>
        </div>
      </div>
    </div>
  );
}

// 'rack' is the ownership filter — distinct from the kind filters. It shows
// only entries the user physically holds (owned === true).
const FILTERS: Array<{ id: 'all' | Kind | 'rack'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'wine', label: 'Wine' },
  { id: 'beer', label: 'Beer' },
  { id: 'spirits', label: 'Spirits' },
  { id: 'rack', label: 'In the Rack' },
];

const EMPTY_HERO = 'https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/b99cf7d2-b486-4210-a8de-c3705f414684.png';

export function Cellar() {
  const [, navigate] = useLocation();
  const cellar = useStore((s) => s.cellar);
  const user = useStore((s) => s.user);
  const booted = useStore((s) => s.booted);
  const [filter, setFilter] = useState<typeof FILTERS[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [authOpen, setAuthOpen] = useState(false);

  // Once auth state has settled, anonymous users get the sign-in sheet
  // automatically. We don't open it before then to avoid a flash for users
  // who are about to be recognized as authenticated.
  useEffect(() => {
    if (booted && !user) setAuthOpen(true);
  }, [booted, user]);

  // Search state. When a query is active, results come from the backend
  // interpretation (searchCellar); when empty, we show the client-side
  // filtered view instantly.
  const [searchResults, setSearchResults] = useState<CellarEntry[] | null>(null);
  const [searchReasons, setSearchReasons] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  // The active filter chips, translated into backend params.
  const filterParams = useMemo(() => {
    if (filter === 'rack') return { owned: true as const };
    if (filter === 'wine' || filter === 'beer' || filter === 'spirits') return { kind: filter };
    return {};
  }, [filter]);

  // Client-side filtered set — used directly when the query is empty, and as
  // the base for the local fallback.
  const filtered = useMemo(() => {
    let entries = cellar;
    if (filter === 'rack') {
      entries = entries.filter((e) => e.owned === true);
    } else if (filter !== 'all') {
      entries = entries.filter((e) => e.kind === filter);
    }
    return entries;
  }, [cellar, filter]);

  // Debounced natural-language search. Interprets the query against the
  // user's own cellar via the backend; keeps prior results on screen while a
  // new query is in flight so the grid does not flash.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      setSearchReasons({});
      setSearching(false);
      setUsedFallback(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const { matches, usedFallback: fb } = await api.searchCellar({ query: q, ...filterParams });
        if (cancelled) return;
        setSearchResults(matches.map((m) => m.entry));
        const reasons: Record<string, string> = {};
        for (const m of matches) if (m.reason) reasons[m.entry.id] = m.reason;
        setSearchReasons(reasons);
        setUsedFallback(fb);
      } catch {
        // Unexpected client/network error — degrade to a local substring match
        // so the search still returns something usable.
        if (cancelled) return;
        const needle = q.toLowerCase();
        const local = filtered.filter((e) =>
          [e.name, e.producer, e.region, e.notes]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(needle),
        );
        setSearchResults(local);
        setSearchReasons({});
        setUsedFallback(true);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, filterParams, filtered]);

  const hasQuery = search.trim().length > 0;
  const visible = hasQuery ? (searchResults ?? []) : filtered;

  // Show the empty / signed-out states only after boot to avoid flashing.
  const showSignedOut = booted && !user;
  const isEmpty = booted && user && cellar.length === 0;
  const showLoading = !booted;

  return (
    <div className="canvas">
      <Atmosphere />
      <div className="ember-room" aria-hidden="true" />
      <div className="app-shell">
        <Header />

        <motion.main
          className="cellar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.std, ease: EASE.standard }}
        >
          <button className="btn-tertiary cellar__back" onClick={() => navigate('/')}>
            <IconArrowLeft size={16} stroke={1.6} /> Camera
          </button>

          {showLoading && <CellarSkeleton />}

          {showSignedOut && (
            <div className="cellar__signed-out">
              <div className="cellar__hero-wrap">
                <img className="cellar__hero" src={img(EMPTY_HERO, 1200) || EMPTY_HERO} alt="" />
                <div className="cellar__hero-grad" aria-hidden="true" />
              </div>
              <div className="cellar__signed-out-copy">
                <h1 className="t-display t-display--italic">Your cellar begins here.</h1>
                <p className="t-body">Sign in to save bottles, take notes, and let the recommendations get sharper.</p>
                <button className="btn-primary" onClick={() => setAuthOpen(true)}>
                  Sign in
                </button>
              </div>
            </div>
          )}

          {isEmpty && <EmptyCellar onCameraOpen={() => navigate('/')} />}

          {booted && user && cellar.length > 0 && (
            <>
              <h1 className="t-headline cellar__title">Your cellar</h1>

              <div className="cellar__chips">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    className={`cellar__chip ${filter === f.id ? 'is-active' : ''}`}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="cellar__search">
                <IconSearch size={16} stroke={1.5} />
                {/* Personalize the placeholder when the user has a display
                    name on file. First-name only — full names read oddly in
                    a placeholder. Falls back to a neutral prompt for users
                    who haven't set a name yet. */}
                <input
                  className="cellar__search-input"
                  placeholder={
                    user?.displayName
                      ? `What are you looking for, ${user.displayName.split(' ')[0]}?`
                      : 'What are you looking for?'
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Quiet, non-blocking progress while interpreting a query. */}
              {searching && (
                <p className="t-caption cellar__searching" aria-live="polite">
                  Looking through your cellar
                </p>
              )}

              {visible.length === 0 && !searching ? (
                hasQuery ? (
                  // No entry meaningfully fit the request. Warm, not an error;
                  // the query stays editable so the user can adjust.
                  <div className="cellar__no-match">
                    <p className="t-aside">Nothing in your cellar quite fits that.</p>
                    <p className="t-caption">Try asking a different way, or loosen the filters.</p>
                    <button className="btn-tertiary" onClick={() => setSearch('')}>
                      Clear search
                    </button>
                  </div>
                ) : filter === 'rack' ? (
                  // Distinct empty state for the ownership filter — nothing
                  // is marked as held yet. In voice, an invitation not an error.
                  <div className="cellar__no-match">
                    <p className="t-aside">Nothing in the rack yet.</p>
                    <p className="t-caption">Mark a bottle as on hand from any entry and it shows up here.</p>
                    <button className="btn-tertiary" onClick={() => setFilter('all')}>
                      Back to all
                    </button>
                  </div>
                ) : (
                  <div className="cellar__no-match">
                    <p className="t-aside">Nothing here under that filter.</p>
                    <button className="btn-tertiary" onClick={() => setFilter('all')}>
                      Back to all
                    </button>
                  </div>
                )
              ) : (
                <>
                  {hasQuery && usedFallback && !searching && (
                    <p className="t-caption cellar__fallback-note">
                      Showing a simpler word match for now.
                    </p>
                  )}
                  <CellarMosaic
                    entries={visible}
                    hideOwnedDots={filter === 'rack'}
                    reasons={hasQuery ? searchReasons : undefined}
                    showAvailability={hasQuery && filter !== 'rack'}
                  />
                </>
              )}
            </>
          )}
        </motion.main>

        <AnimatePresence>
          {authOpen && (
            <AuthSheet
              open={authOpen}
              onClose={() => {
                setAuthOpen(false);
                if (!user) navigate('/');
              }}
              onSuccess={() => undefined}
            />
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .cellar {
          flex: 1;
          padding: 8px 20px 64px;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
        }
        @media (min-width: 760px) { .cellar { padding: 16px 32px 80px; } }
        .cellar__back { padding-left: 0; margin-bottom: 8px; }
        .cellar__title { margin-bottom: 20px; }
        .cellar__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }
        .cellar__chip {
          padding: 8px 14px;
          background: var(--smoke);
          color: var(--bone);
          border: 1px solid var(--border-subtle);
          border-radius: 999px;
          font: 500 12px var(--font-geist);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition:
            color 200ms var(--ease-standard),
            background 200ms var(--ease-standard),
            border-color 200ms var(--ease-standard);
        }
        .cellar__chip:hover { color: var(--parchment); }
        .cellar__chip.is-active {
          background: var(--ember);
          color: var(--midnight);
          border-color: var(--ember);
        }
        .cellar__search {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px;
          background: var(--smoke);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          color: var(--bone);
          margin-bottom: 24px;
          transition: border-color 180ms var(--ease-standard);
        }
        .cellar__search:focus-within {
          border-color: var(--ember);
        }
        .cellar__search-input {
          flex: 1;
          background: none;
          color: var(--parchment);
          font: italic 16px var(--font-rowan);
          letter-spacing: -0.005em;
        }
        .cellar__search-input::placeholder {
          color: color-mix(in oklch, var(--bone) 50%, transparent);
        }
        .cellar__signed-out, .cellar__empty {
          position: relative;
          min-height: 70dvh;
          display: flex;
          flex-direction: column;
        }
        .cellar__hero-wrap {
          position: absolute;
          inset: 0 -20px;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }
        @media (min-width: 760px) {
          .cellar__hero-wrap { inset: 0 -32px; }
        }
        .cellar__hero {
          width: 100%; height: 100%;
          object-fit: cover;
          filter: brightness(0.85);
          animation: ken-burns 32s ease-in-out infinite alternate;
        }
        @keyframes ken-burns {
          0%   { transform: scale(1); }
          100% { transform: scale(1.06); }
        }
        .cellar__hero-grad {
          position: absolute; inset: 0;
          background: linear-gradient(180deg in oklch,
            color-mix(in oklch, var(--midnight) 30%, transparent) 0%,
            color-mix(in oklch, var(--midnight) 60%, transparent) 50%,
            var(--midnight) 100%);
        }
        .cellar__signed-out-copy, .cellar__empty-copy {
          position: relative;
          z-index: 1;
          margin-top: auto;
          padding: 32px 16px 32px;
          text-align: center;
          max-width: 480px;
          align-self: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }
        .cellar__signed-out-copy h1, .cellar__empty-copy h1 { margin-bottom: 4px; }
        .cellar__signed-out-copy p, .cellar__empty-copy p { color: var(--bone); }
        .cellar__empty-actions { margin: 4px 0 12px; }
        .cellar__no-match {
          padding: 80px 24px;
          text-align: center;
          max-width: 380px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cellar__no-match .btn-tertiary { align-self: center; }
        .cellar__searching {
          color: color-mix(in oklch, var(--bone) 55%, transparent);
          margin-bottom: 16px;
          animation: cellar-searching-pulse 1.6s ease-in-out infinite;
        }
        @keyframes cellar-searching-pulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        .cellar__fallback-note {
          color: color-mix(in oklch, var(--bone) 55%, transparent);
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
}
