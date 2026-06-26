import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'wouter';
import { useStore } from '../store';
import { api } from '../api';
import { img } from '../lib/cdn';
import { EASE, DUR } from '../lib/motion';
import { IconArrowRight, IconCamera } from '@tabler/icons-react';

// Key for the localStorage handoff when an anonymous user seeds their taste
// on the welcome screen. App.tsx picks this up after the next auth resolves
// and applies it to the new user's profile, then clears the key.
export const PENDING_TASTE_SEED_KEY = 'somm-taste-seed-pending';

// First slide title is personalized when the user has a displayName set
// (i.e. they are returning on a new device after onboarding).
const SLIDES = [
  {
    key: 'intro',
    image: 'https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/b8d7fb5e-6956-4c45-90e7-673e65290427.png',
    alt: 'A wine coupe in candlelight',
    title: 'Hello, friend.',
    titleNamed: (name: string) => `Hello, ${name}.`,
    body:
      'I am SommSavvy. I help you find what to drink and what you are drinking. The voice has a sense of humor. The recommendations do not. Curious, comfortable, or serious — your call, in profile.',
    cta: 'Continue',
  },
  {
    key: 'multi',
    image: 'https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/0dcf0b20-68f9-48cb-85bc-a3c9469411de.png',
    alt: 'Wine, beer, and spirits in candlelight',
    title: 'Photo, voice, or text.',
    body:
      'Wine, beer, spirits — all three. Show me what you are having and I will find the pour.',
    cta: 'Continue',
  },
  {
    key: 'cellar',
    image: 'https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/b99cf7d2-b486-4210-a8de-c3705f414684.png',
    alt: 'After-hours wine bar',
    title: 'Your cellar grows.',
    body:
      'Save what you love. The more you save, the better the recommendations get. No pressure.',
    cta: 'Open the camera',
  },
] as const;

export function Welcome() {
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const markSeen = useStore((s) => s.markWelcomeSeen);
  const setUser = useStore((s) => s.setUser);
  const cellarCount = useStore((s) => s.cellarCount);
  const user = useStore((s) => s.user);
  const [, navigate] = useLocation();
  const firstName = user?.displayName?.split(' ')[0]?.trim();

  // Taste-seeding state, scoped to slide 3.
  const [seedExpanded, setSeedExpanded] = useState(false);
  const [seedText, setSeedText] = useState('');
  const [seedSaving, setSeedSaving] = useState(false);

  const finish = () => {
    markSeen();
    navigate('/');
  };

  // Persist the seed before exiting welcome. Two paths:
  //   - Signed in: save directly via updateProfile (regen fires server-side).
  //   - Anonymous: stash in localStorage; App.tsx picks it up after first auth.
  // Either path resolves quickly. Failures fall through silently — the user
  // is on their way to the camera and the seed is recoverable.
  const persistSeed = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (user) {
      try {
        const { user: updated } = await api.updateProfile({ tasteSeed: trimmed });
        setUser(updated, cellarCount);
      } catch (err) {
        console.error('Saving taste seed failed:', err);
      }
    } else {
      try {
        localStorage.setItem(PENDING_TASTE_SEED_KEY, trimmed);
      } catch (err) {
        // Storage full / private mode — non-fatal.
        console.error('Could not stash taste seed:', err);
      }
    }
  };

  const next = async () => {
    // On the final slide, persist any seeded taste before exiting.
    if (idx >= SLIDES.length - 1) {
      if (seedText.trim()) {
        setSeedSaving(true);
        await persistSeed(seedText);
        setSeedSaving(false);
      }
      finish();
      return;
    }
    setDirection(1);
    setIdx(idx + 1);
  };

  const slide = SLIDES[idx];
  // The seed affordance only shows on the final slide. Earlier slides
  // shouldn't ask the user to commit before they understand the product.
  const isFinalSlide = idx === SLIDES.length - 1;

  return (
    <div className="welcome">
      <button className="welcome__skip" onClick={finish} aria-label="Skip">
        Skip
      </button>

      <AnimatePresence custom={direction} mode="wait">
        <motion.div
          key={slide.key}
          className="welcome__slide"
          custom={direction}
          initial={{ opacity: 0, x: direction * 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -16 }}
          transition={{ duration: DUR.slow, ease: EASE.glide }}
        >
          <motion.img
            className="welcome__img"
            src={img(slide.image, 1200) || slide.image}
            alt={slide.alt}
            initial={{ scale: 1.04 }}
            animate={{ scale: 1.0 }}
            exit={{ scale: 0.98 }}
            transition={{ duration: 0.6, ease: EASE.glide }}
          />
          <motion.div
            className="welcome__copy"
            initial={{ x: direction * -8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * 8, opacity: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.glide, delay: 0.08 }}
          >
            <h1 className="t-display t-display--italic welcome__title">
              {firstName && 'titleNamed' in slide && typeof slide.titleNamed === 'function'
                ? slide.titleNamed(firstName)
                : slide.title}
            </h1>
            <p className="t-body welcome__body">{slide.body}</p>

            {/*
              Optional taste-seeding affordance, only on the final slide.
              Collapsed by default — the default path is unchanged. Users
              who want to seed get a one-line invitation that expands to a
              textarea. This is cold-start mitigation: the user's own
              words become foundational signal in the taste profile from
              day zero, before the cellar has any data in it.
            */}
            {isFinalSlide && (
              <div className="welcome__seed">
                <AnimatePresence mode="wait" initial={false}>
                  {!seedExpanded ? (
                    <motion.button
                      key="seed-link"
                      type="button"
                      className="welcome__seed-link"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: DUR.fast, ease: EASE.standard }}
                      onClick={() => setSeedExpanded(true)}
                    >
                      Tell me about your taste first.
                    </motion.button>
                  ) : (
                    <motion.div
                      key="seed-input"
                      className="welcome__seed-input"
                      initial={{ opacity: 0, y: -4, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -4, height: 0 }}
                      transition={{ duration: DUR.slow, ease: EASE.glide }}
                    >
                      <textarea
                        className="welcome__seed-ta"
                        value={seedText}
                        onChange={(e) => setSeedText(e.target.value)}
                        placeholder="Bold reds. Hate sweet wines. A weakness for Northern Rhône syrah and dry rieslings. Curious about beer beyond IPAs. — Any of it. All optional."
                        rows={4}
                        maxLength={1500}
                        autoFocus
                      />
                      <p className="t-caption welcome__seed-hint">
                        Optional. I will weave this into how I read you from your first scan.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button
              className="btn-primary welcome__cta"
              onClick={next}
              disabled={seedSaving}
            >
              {seedSaving ? 'Saving…' : slide.cta}
              {idx === SLIDES.length - 1 ? <IconCamera size={18} stroke={1.6} /> : <IconArrowRight size={18} stroke={1.6} />}
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <div className="welcome__dots">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`welcome__dot ${i === idx ? 'is-active' : ''}`}
            onClick={() => {
              setDirection(i > idx ? 1 : -1);
              setIdx(i);
            }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      <style>{`
        .welcome {
          position: fixed; inset: 0;
          background: var(--midnight);
          z-index: 90;
          overflow: hidden;
        }
        .welcome__skip {
          position: absolute;
          top: max(20px, env(safe-area-inset-top, 0px));
          right: 24px;
          z-index: 4;
          color: color-mix(in oklch, var(--bone) 65%, transparent);
          font: 500 13px var(--font-geist);
          letter-spacing: 0.06em;
          padding: 8px 12px;
          transition: color 180ms var(--ease-standard);
        }
        .welcome__skip:hover { color: var(--ember); }
        .welcome__slide {
          position: absolute; inset: 0;
          display: flex;
          flex-direction: column;
        }
        .welcome__img {
          flex: 1;
          width: 100%;
          object-fit: cover;
          min-height: 0;
        }
        .welcome__copy {
          position: relative;
          padding: 32px 32px max(56px, env(safe-area-inset-bottom));
          text-align: center;
          background: linear-gradient(180deg in oklch,
            transparent 0%,
            color-mix(in oklch, var(--midnight) 60%, transparent) 30%,
            var(--midnight) 60%);
          margin-top: -120px;
          z-index: 2;
        }
        @media (min-width: 760px) {
          .welcome__slide { flex-direction: row; align-items: stretch; }
          .welcome__img { flex: 1.2; height: 100%; }
          .welcome__copy {
            flex: 1;
            background: var(--midnight);
            margin-top: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 64px;
            text-align: left;
            align-items: flex-start;
          }
        }
        .welcome__title {
          font-size: clamp(40px, 8vw, 64px);
          margin-bottom: 16px;
        }
        .welcome__body {
          color: var(--bone);
          margin-bottom: 28px;
          max-width: 480px;
          margin-inline: auto;
        }
        @media (min-width: 760px) {
          .welcome__body { margin-inline: 0; }
        }
        .welcome__cta {
          margin: 0 auto;
        }
        @media (min-width: 760px) { .welcome__cta { margin: 0; } }
        .welcome__seed {
          max-width: 480px;
          margin: 0 auto 20px;
          /* Reserve space so the link → textarea expansion doesn't push
             the CTA off-screen on short viewports. */
          min-height: 24px;
          width: 100%;
        }
        @media (min-width: 760px) {
          .welcome__seed { margin: 0 0 20px; max-width: 520px; }
        }
        .welcome__seed-link {
          color: color-mix(in oklch, var(--bone) 55%, transparent);
          font-style: italic;
          font-family: var(--font-rowan, var(--font-geist));
          font-size: 15px;
          padding: 4px 12px;
          background: none;
          transition: color 200ms var(--ease-standard);
        }
        .welcome__seed-link:hover { color: var(--ember); }
        .welcome__seed-input { overflow: hidden; }
        .welcome__seed-ta {
          width: 100%;
          background: color-mix(in oklch, var(--midnight) 50%, transparent);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          color: var(--bone);
          font: 400 15px/1.5 var(--font-geist);
          resize: vertical;
          min-height: 110px;
          max-height: 220px;
          transition: border-color 200ms var(--ease-standard);
          backdrop-filter: blur(6px);
        }
        .welcome__seed-ta::placeholder {
          color: color-mix(in oklch, var(--bone) 35%, transparent);
          font-style: italic;
          font-family: var(--font-rowan, var(--font-geist));
        }
        .welcome__seed-ta:focus-visible {
          outline: none;
          border-color: var(--ember);
        }
        .welcome__seed-hint {
          color: color-mix(in oklch, var(--bone) 50%, transparent);
          font-style: italic;
          font-family: var(--font-rowan, var(--font-geist));
          margin: 6px 0 0;
          text-align: left;
        }
        .welcome__dots {
          position: absolute;
          left: 0; right: 0;
          bottom: max(20px, env(safe-area-inset-bottom, 0px));
          display: flex;
          justify-content: center;
          gap: 12px;
          z-index: 3;
        }
        .welcome__dot {
          width: 6px; height: 6px;
          border-radius: 999px;
          background: color-mix(in oklch, var(--bone) 30%, transparent);
          transition: background 220ms var(--ease-standard), transform 220ms var(--ease-standard);
        }
        .welcome__dot.is-active {
          background: var(--ember);
          transform: scale(1.3);
        }
      `}</style>
    </div>
  );
}
