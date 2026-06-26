import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'motion/react';
import { auth } from '@mindstudio-ai/interface';
import { IconArrowLeft, IconLoader2 } from '@tabler/icons-react';
import { Header } from '../components/Header';
import { Atmosphere } from '../components/Atmosphere';
import { useStore } from '../store';
import { api } from '../api';
import { EASE, DUR } from '../lib/motion';
import type { Depth } from '../types';

export function Profile() {
  const [, navigate] = useLocation();
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const cellarCount = useStore((s) => s.cellarCount);
  const depth = useStore((s) => s.depth);
  const setDepth = useStore((s) => s.setDepth);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const booted = useStore((s) => s.booted);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [refreshing, setRefreshing] = useState(false);

  // Wait until boot before deciding the user is anonymous.
  if (booted && !user) {
    navigate('/cellar');
    return null;
  }

  if (!user) {
    return (
      <div className="canvas">
        <Atmosphere />
        <div className="ember-room" aria-hidden="true" />
        <div className="app-shell">
          <Header />
          <main style={{ padding: 32, textAlign: 'center', flex: 1 }}>
            <p className="t-aside" style={{ color: 'var(--bone)', opacity: 0.7 }}>One moment.</p>
          </main>
        </div>
      </div>
    );
  }

  const saveProfile = async (next: { displayName?: string; depthPreference?: Depth; tasteSeed?: string }) => {
    try {
      const { user: updated } = await api.updateProfile(next);
      setUser(updated, cellarCount);
    } catch (err) {
      console.error('Profile save failed', err);
    }
  };

  const refreshTaste = async () => {
    setRefreshing(true);
    try {
      await api.regenerateTasteSummary();
      // Re-pull the user.
      const { user: updated } = await api.getMe();
      if (updated) setUser(updated, cellarCount);
    } catch (err) {
      console.error('Taste refresh failed', err);
    } finally {
      setRefreshing(false);
    }
  };

  const signOut = async () => {
    await auth.logout();
    setUser(null, 0);
    navigate('/');
  };

  const depths: Depth[] = ['beginner', 'enthusiast', 'expert'];

  return (
    <div className="canvas">
      <Atmosphere />
      <div className="ember-room" aria-hidden="true" />
      <div className="app-shell">
        <Header />

        <motion.main
          className="prof"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.std, ease: EASE.standard }}
        >
          <button className="btn-tertiary prof__back" onClick={() => navigate('/')}>
            <IconArrowLeft size={16} stroke={1.6} /> Camera
          </button>

          <h1 className="t-headline prof__title">Your shelf</h1>

          <section className="prof__sec">
            <p className="t-label">Display name</p>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => saveProfile({ displayName })}
              placeholder="What should I call you?"
            />
          </section>

          <section className="prof__sec">
            <p className="t-label">Email</p>
            <p className="t-body prof__email">{user.email}</p>
          </section>

          <section className="prof__sec">
            <p className="t-label">How I read you</p>
            <div className="prof__seg">
              {depths.map((d) => (
                <button
                  key={d}
                  className={`prof__seg-btn ${depth === d ? 'is-active' : ''}`}
                  onClick={() => {
                    setDepth(d);
                    saveProfile({ depthPreference: d });
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
            {/*
              A short, character-driven description of the selected depth.
              Each one is a description of how the writing changes — not a
              skill rating. No "for new drinkers" or "for sommeliers"; no
              "easier" or "harder". A beginner can pick Expert because they
              want it terse; an expert can pick Beginner because they want
              longer notes to share with a friend. Respect dial, not skill
              rating.
            */}
            <p className="t-aside prof__seg-help">
              {depth === 'beginner' && 'More context. The why and how behind each pick.'}
              {depth === 'enthusiast' && 'Confident and quick. On the level.'}
              {depth === 'expert' && 'Tight, technical, no preamble.'}
            </p>
          </section>

          <section className="prof__sec">
            <p className="t-label">Daylight</p>
            <button className="prof__theme" onClick={toggleTheme} aria-pressed={theme === 'day'}>
              <span className={`prof__theme-knob ${theme === 'day' ? 'is-on' : ''}`} />
              <span className="t-caption">{theme === 'day' ? 'Daylight is on' : 'Midnight'}</span>
            </button>
          </section>

          <section className="prof__sec">
            <div className="prof__taste-head">
              <p className="t-label">Your taste profile</p>
              <button className="btn-tertiary prof__refresh" onClick={refreshTaste} disabled={refreshing}>
                {refreshing ? <IconLoader2 size={14} className="spin" /> : 'Refresh'}
              </button>
            </div>
            {user.tasteSummary?.trim() ? (
              <p className="t-why">{user.tasteSummary}</p>
            ) : (
              <p className="t-aside prof__taste-empty">
                {/*
                  Empty-state copy is in voice — the somm is candid that the
                  profile is still forming, and frames cellar entries + the
                  seed below as the way to shape it. Not a generic emptiness
                  message; an invitation.
                */}
                I am still getting to know you. Save a few bottles and patterns start
                to emerge. The note below seeds the rest.
              </p>
            )}
          </section>

          <section className="prof__sec">
            <p className="t-label">In your own words</p>
            <p className="t-aside prof__seed-help">
              Whatever you want me to know. Producers you reach for, things you avoid,
              the dinner that converted you. I weave this in.
            </p>
            <textarea
              className="input prof__seed-ta"
              defaultValue={user.tasteSeed || ''}
              onBlur={(e) => {
                const next = e.target.value.trim();
                // Only save when the value actually changed, to avoid no-op
                // regeneration round-trips on focus-out-without-edit.
                if (next !== (user.tasteSeed || '').trim()) {
                  saveProfile({ tasteSeed: next });
                }
              }}
              placeholder="Bold reds. Hate sweet wines. A weakness for Northern Rhône syrah and dry rieslings. — Any of it. All optional."
              rows={4}
              maxLength={1500}
            />
          </section>

          <section className="prof__sec">
            <button className="prof__signout" onClick={signOut}>
              Sign out
            </button>
          </section>
        </motion.main>
      </div>

      <style>{`
        .prof {
          flex: 1;
          padding: 8px 20px 64px;
          max-width: 600px;
          width: 100%;
          margin: 0 auto;
        }
        .prof__back { padding-left: 0; margin-bottom: 8px; }
        .prof__title { margin-bottom: 24px; }
        .prof__sec { margin-bottom: 24px; }
        .prof__sec .t-label { margin-bottom: 8px; }
        .prof__email { color: var(--bone); }
        .prof__seg {
          display: inline-flex;
          padding: 4px;
          background: var(--smoke);
          border: 1px solid var(--border-subtle);
          border-radius: 999px;
          gap: 4px;
        }
        .prof__seg-btn {
          padding: 8px 16px;
          font: 500 12px var(--font-geist);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: color-mix(in oklch, var(--bone) 60%, transparent);
          border-radius: 999px;
          transition: color 180ms var(--ease-standard), background 180ms var(--ease-standard);
        }
        .prof__seg-btn.is-active {
          color: var(--midnight);
          background: var(--ember);
        }
        .prof__seg-help {
          margin-top: 10px;
          color: color-mix(in oklch, var(--bone) 60%, transparent);
          font-size: 14px;
          /* Reserve a line height so the description swap doesn't shift
             surrounding sections. */
          min-height: 1.4em;
        }
        .prof__theme {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 8px 14px;
          background: var(--smoke);
          border: 1px solid var(--border-subtle);
          border-radius: 999px;
        }
        .prof__theme-knob {
          width: 36px; height: 20px;
          border-radius: 999px;
          background: color-mix(in oklch, var(--bone) 20%, transparent);
          position: relative;
          transition: background 240ms var(--ease-standard);
        }
        .prof__theme-knob::after {
          content: '';
          position: absolute;
          top: 2px; left: 2px;
          width: 16px; height: 16px;
          border-radius: 999px;
          background: var(--parchment);
          transition: transform 240ms var(--ease-standard);
        }
        .prof__theme-knob.is-on { background: var(--ember); }
        .prof__theme-knob.is-on::after { transform: translateX(16px); }
        .prof__taste-head { display: flex; align-items: center; justify-content: space-between; }
        .prof__refresh { padding: 6px 10px; }
        .prof__taste-empty {
          /* Italic Rowan tone matches the depth-dial help line — quiet,
             conversational, not utility-software empty. */
          font-style: italic;
          font-family: var(--font-rowan, var(--font-geist));
          color: color-mix(in oklch, var(--bone) 65%, transparent);
          margin: 0;
        }
        .prof__seed-help {
          color: color-mix(in oklch, var(--bone) 55%, transparent);
          font-style: italic;
          font-family: var(--font-rowan, var(--font-geist));
          margin: 0 0 10px;
        }
        .prof__seed-ta {
          width: 100%;
          resize: vertical;
          min-height: 96px;
          max-height: 240px;
          font: 400 15px/1.5 var(--font-geist);
        }
        .prof__seed-ta::placeholder {
          color: color-mix(in oklch, var(--bone) 35%, transparent);
          font-style: italic;
          font-family: var(--font-rowan, var(--font-geist));
        }
        .prof__signout {
          color: color-mix(in oklch, var(--bordeaux) 70%, var(--bone));
          font: 500 14px var(--font-geist);
          letter-spacing: 0.02em;
          padding: 8px 0;
          background: none;
          transition: color 180ms var(--ease-standard);
        }
        .prof__signout:hover { color: var(--bordeaux); }
      `}</style>
    </div>
  );
}
