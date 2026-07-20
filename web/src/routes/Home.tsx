import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'motion/react';
import { IconKeyboard, IconMicrophone } from '@tabler/icons-react';
import { Header } from '../components/Header';
import { Atmosphere } from '../components/Atmosphere';
import { Shutter } from '../components/Shutter';
import { AltButton } from '../components/AltButton';
import { Viewfinder, type ViewfinderHandle } from '../components/Viewfinder';
import { ScanningOverlay } from '../components/ScanningOverlay';
import { TextInputSheet } from '../components/TextInputSheet';
import { VoiceCandle } from '../components/VoiceCandle';
import { LibraryButton } from '../components/LibraryButton';
import { useStore, type SmartScanData } from '../store';
import { api } from '../api';
import { uploadImage } from '../lib/upload';

// Per-session greeting key — once shown in a tab session, don't show again.
const GREETING_KEY = 'somm-greeting-shown';

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Welcome back';
}

// Single unified tagline — mode is now determined by the backend.
const TAGLINE = 'Show it what you have. It figures out the rest.';

export function Home() {
  const [, navigate] = useLocation();
  const depth = useStore((s) => s.depth);
  const user = useStore((s) => s.user);
  const setRouting = useStore((s) => s.setRouting);
  const setResult = useStore((s) => s.setResult);
  const setSession = useStore((s) => s.setSession);
  const setScanError = useStore((s) => s.setScanError);

  const vfRef = useRef<ViewfinderHandle>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('Reading the room...');
  const [textOpen, setTextOpen] = useState(false);
  // Personalized greeting that appears once per tab session for users
  // with a name set. Quietly fades after a few seconds.
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for the recapture notice from an override redirect.
  const [recaptureNotice, setRecaptureNotice] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get('notice') === 'capture-again') {
      // Clean the URL so the notice does not persist on refresh.
      window.history.replaceState(null, '', '/');
      return 'That context has expired. Point the camera again to start fresh.';
    }
    return null;
  });

  const hasInteracted = useRef(false);

  // Show the personalized greeting once per session when a signed-in user
  // with a displayName lands on home. Stored in sessionStorage so it does
  // not repeat as the user navigates between routes within the same tab,
  // but fires fresh next time they open the app.
  useEffect(() => {
    if (!user?.displayName) return;
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem(GREETING_KEY)) return;
    sessionStorage.setItem(GREETING_KEY, '1');
    setGreetingVisible(true);
    const t = setTimeout(() => setGreetingVisible(false), 4200);
    return () => clearTimeout(t);
  }, [user?.displayName]);

  // Run smartScan with the given input. Streaming status comes
  // back via handlers and updates the scanning overlay. Navigation to
  // /result happens on the first routing event — not the final result —
  // so the user sees the result skeleton as soon as the backend decides
  // the surface (identify vs pair).
  const runMethod = async (opts: { imageUrl?: string; text?: string }) => {
    setError(null);
    setScanning(true);
    // Status copy adapts to the input source. Voice flows through as text by
    // the time we get here (transcribed before runMethod fires), so text and
    // voice share the same opener — by the moment Done is tapped, the user
    // has stopped speaking and the somm has stopped listening. "Considering"
    // is the honest verb for both. Photos still get "Reading the label."
    const opener = opts.imageUrl ? 'Reading the label...' : 'Considering...';
    setStatus(opener);

    setSession({ imageUrl: opts.imageUrl, text: opts.text });

    let navigated = false;

    try {
      await api.smartScan(
        { imageUrl: opts.imageUrl, text: opts.text, depth },
        {
          onStatus: (text) => setStatus(text),
          onRouting: (meta) => {
            // Set routing metadata in the store so Result can render
            // the correct surface immediately (skeleton-to-full).
            setRouting(meta);
            if (!navigated) {
              navigated = true;
              setScanning(false);
              navigate('/result');
            }
          },
          onPartial: (data) => {
            // The backend streams the text card before portrait generation.
            // Populate the store so Result can render the card text immediately
            // instead of showing a skeleton for the full duration.
            setResult(data as SmartScanData);
          },
          onResult: (res) => {
            // Final result includes the portrait URL. Replace the partial.
            setRouting({ mode: res.mode, ambiguous: res.ambiguous, confidence: res.confidence });
            setResult(res.data);
            if (!navigated) {
              navigated = true;
              setScanning(false);
              navigate('/result');
            }
          },
          onError: (err) => {
            if (err.code === 'CONTEXT_EXPIRED') {
              // Whether navigated or not, send user back to Home with
              // the recapture notice.
              if (navigated) {
                navigate('/?recapture=1');
              } else {
                setScanning(false);
                setRecaptureNotice(
                  'That context has expired. Point the camera again to start fresh.',
                );
              }
              return;
            }
            if (navigated) {
              // User is already on /result — surface the error there.
              setScanError('Something went sideways. Try scanning again.');
            } else {
              setError(err.message || 'Need a moment. Take a sip.');
              setScanning(false);
            }
          },
        },
      );
    } catch (err) {
      console.error('Method failed:', err);
      const msg = err instanceof Error ? err.message : 'Need a moment. Take a sip.';
      setError(msg);
      setScanning(false);
      // Keep the captured photo visible so user can retry.
    }
  };

  const handleCapture = async () => {
    hasInteracted.current = true;
    setError(null);
    setRecaptureNotice(null);
    const result = await vfRef.current?.capture();
    if (!result) {
      // No camera. Open text input as the natural fallback.
      setTextOpen(true);
      return;
    }
    setCapturedDataUrl(result.dataUrl);

    try {
      // Upload to server so the backend can analyze the image by URL.
      const url = await uploadImage(
        new File([result.blob], 'capture.jpg', { type: 'image/jpeg' }),
      );
      await runMethod({ imageUrl: url });
    } catch (err) {
      console.error('Upload failed:', err);
      setError('The image came through blurry. One more try?');
      // Retain the captured preview so the user sees what they shot and can retry.
    }
  };

  // Handle a photo picked from the user's photo library / file system.
  // Reads as JPEG-or-whatever from the picker, optimistically shows it in
  // the viewfinder so the user sees their choice land, uploads to the CDN,
  // then routes to the current mode (Somm or Scan) just like a fresh
  // camera capture would.
  const handleLibraryPick = async (file: File) => {
    hasInteracted.current = true;
    setError(null);
    setRecaptureNotice(null);

    // Read into a data URL so we can show the picked image in the viewfinder
    // while the upload runs in parallel. Same visual moment as a shutter
    // capture — no blank loading state.
    const dataUrl = await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    });
    if (dataUrl) setCapturedDataUrl(dataUrl);

    try {
      const url = await uploadImage(file);
      await runMethod({ imageUrl: url });
    } catch (err) {
      console.error('Library upload failed:', err);
      setError('That image did not come through. One more try?');
      // Retain the picked preview so the user can see it and retry.
    }
  };

  const handleText = async (text: string) => {
    hasInteracted.current = true;
    setTextOpen(false);
    setRecaptureNotice(null);
    await runMethod({ text });
  };

  const handleVoice = async (text: string) => {
    hasInteracted.current = true;
    setVoiceOpen(false);
    setRecaptureNotice(null);
    if (text.trim()) {
      await runMethod({ text });
    }
  };

  // Pick the right tagline.
  const tagline = TAGLINE;

  // Reset captured frame when the user backs out of scanning.
  useEffect(() => {
    if (!scanning && !error) {
      // Hold the captured photo briefly, then clear.
      const t = setTimeout(() => setCapturedDataUrl(null), 600);
      return () => clearTimeout(t);
    }
  }, [scanning, error]);

  return (
    <div className="canvas">
      <Atmosphere />
      <div className="ember-room" aria-hidden="true" />
      <div className="app-shell home">
        <Header />

        <main className="home__main">

          {/*
            Quiet personalized greeting. Fades in once per session for users
            with a displayName, then quietly fades out. Holds its space so
            the layout doesn't shift.
          */}
          <div className="home__greeting" aria-live="polite">
            <AnimatePresence>
              {greetingVisible && user?.displayName && (
                <motion.p
                  key="greeting"
                  className="t-aside home__greeting-text"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.5 }}
                >
                  {timeOfDayGreeting()}, <em>{user.displayName.split(' ')[0]}</em>.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="home__viewfinder">
            <Viewfinder ref={vfRef} capturedDataUrl={capturedDataUrl} />
            {/*
              "From the camera roll" pill — anchored to the viewfinder so it
              reads as an alternate camera input rather than a fourth peer of
              voice/text. Hidden mid-flow (scanning or showing a captured
              frame) so it doesn't compete with the active moment.
            */}
            <LibraryButton
              onPick={handleLibraryPick}
              hidden={scanning || !!capturedDataUrl}
              disabled={scanning}
            />
          </div>

          <div className="home__cluster">
            <AltButton onClick={() => setVoiceOpen(true)} ariaLabel="Voice input" invite={!hasInteracted.current} inviteDelay={1200}>
              <IconMicrophone size={20} stroke={1.6} />
            </AltButton>
            <Shutter onCapture={handleCapture} disabled={scanning} />
            <AltButton onClick={() => setTextOpen(true)} ariaLabel="Text input" invite={!hasInteracted.current} inviteDelay={1900}>
              <IconKeyboard size={20} stroke={1.6} />
            </AltButton>
          </div>

          <p className="home__tagline t-aside">{tagline}</p>
          {recaptureNotice && !error && (
            <p className="home__notice t-caption">{recaptureNotice}</p>
          )}
          {error && <p className="home__error t-caption">{error}</p>}
        </main>

        <ScanningOverlay active={scanning} status={status} capturedDataUrl={capturedDataUrl} />
        <TextInputSheet open={textOpen} onClose={() => setTextOpen(false)} onSubmit={handleText} />
        <VoiceCandle open={voiceOpen} onClose={() => setVoiceOpen(false)} onDone={handleVoice} />
      </div>

      <style>{`
        .home__main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 20px 32px;
          gap: 20px;
        }
        @media (min-width: 760px) {
          .home__main { padding: 0 32px 48px; gap: 28px; }
        }
        .home__viewfinder {
          width: 100%;
          max-width: 480px;
          /* Anchor for the absolutely-positioned LibraryButton (bottom-left
             of the viewfinder). */
          position: relative;
        }
        .home__cluster {
          display: flex;
          align-items: center;
          gap: 28px;
        }
        @media (min-width: 760px) { .home__cluster { gap: 36px; } }
        .home__tagline {
          font-size: 16px;
          color: color-mix(in oklch, var(--bone) 75%, transparent);
          text-align: center;
          min-height: 1.4em;
          animation: tagline-in 480ms var(--ease-standard);
        }
        @keyframes tagline-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .home__error {
          color: color-mix(in oklch, var(--bordeaux) 80%, var(--bone));
          margin-top: 4px;
        }
        .home__notice {
          color: color-mix(in oklch, var(--ember) 80%, var(--bone));
          margin-top: 4px;
          text-align: center;
        }
        .home__greeting {
          /* Holds vertical space whether or not the greeting is visible,
             so the viewfinder doesn't jump up when it disappears. */
          min-height: 22px;
          margin-top: -8px;
        }
        .home__greeting-text {
          color: color-mix(in oklch, var(--bone) 80%, transparent);
          font-size: 15px;
          text-align: center;
        }
        .home__greeting-text em {
          color: var(--ember);
          font-style: italic;
          font-family: var(--font-rowan);
        }
      `}</style>
    </div>
  );
}
