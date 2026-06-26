import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { img } from '../lib/cdn';

const FALLBACK_HERO = 'https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/b8d7fb5e-6956-4c45-90e7-673e65290427.png';

export interface ViewfinderHandle {
  capture: () => Promise<{ blob: Blob; dataUrl: string } | null>;
}

interface Props {
  // When non-null, we hold the captured frame instead of the live feed.
  capturedDataUrl: string | null;
  permissionDenied?: boolean;
}

// The viewfinder. Live <video> when permission granted; chiaroscuro hero
// fallback when not. Corner brackets always visible. REC dot when live.
export const Viewfinder = forwardRef<ViewfinderHandle, Props>(function Viewfinder(
  { capturedDataUrl, permissionDenied },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Lazy-init the camera the first time the component mounts. We do not
  // request permission on app load.
  useEffect(() => {
    if (capturedDataUrl) return; // Don't request while showing a captured frame.
    if (permissionDenied) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

    let cancelled = false;
    setRequesting(true);
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setHasPermission(true);
        // Attachment to the <video> element happens in the effect below,
        // once the element is actually mounted.
      })
      .catch(() => {
        // Permission denied or no camera. Fall back to hero.
        setHasPermission(false);
      })
      .finally(() => setRequesting(false));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [capturedDataUrl, permissionDenied]);

  // Wire the live stream to the <video> element after BOTH exist. The video
  // is always rendered (controlled by CSS opacity), so videoRef is reliable
  // here — unlike the previous version where the video only mounted after
  // hasPermission flipped to true, leaving the stream orphaned.
  useEffect(() => {
    const v = videoRef.current;
    const s = streamRef.current;
    if (!hasPermission || !v || !s) return;
    if (v.srcObject !== s) {
      v.srcObject = s;
      v.play().catch(() => undefined);
    }
  }, [hasPermission, capturedDataUrl]);

  // Capture the current frame to a blob + data URL.
  useImperativeHandle(ref, () => ({
    capture: async () => {
      const v = videoRef.current;
      if (!v || !streamRef.current) return null;
      const w = v.videoWidth || 1024;
      const h = v.videoHeight || 1280;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(v, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
      );
      if (!blob) return null;
      return { blob, dataUrl };
    },
  }), []);

  const showLive = !capturedDataUrl && hasPermission;
  const showFallback = !capturedDataUrl && !hasPermission;

  return (
    <div className="vf app-chrome" aria-label="Viewfinder">
      {/*
        The <video> is always mounted so the ref is available the moment
        getUserMedia resolves. Visibility is controlled by opacity so the
        live feed fades up underneath the fallback once permission is
        granted, and disappears cleanly when we show a captured frame.
      */}
      <video
        ref={videoRef}
        className="vf__video"
        style={{ opacity: showLive ? 1 : 0 }}
        autoPlay
        playsInline
        muted
      />

      {capturedDataUrl && (
        <img className="vf__captured" src={capturedDataUrl} alt="Captured" />
      )}

      {showFallback && (
        <img className="vf__fallback" src={img(FALLBACK_HERO, 800) || FALLBACK_HERO} alt="" />
      )}

      {/* Dark overlay for fallback to read better against the candlelit hero */}
      {showFallback && <div className="vf__fallback-overlay" />}

      {/* Corner brackets */}
      <svg className="vf__corner vf__corner--tl" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M0 8 L0 0 L8 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <svg className="vf__corner vf__corner--tr" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M0 8 L0 0 L8 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <svg className="vf__corner vf__corner--bl" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M0 8 L0 0 L8 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <svg className="vf__corner vf__corner--br" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M0 8 L0 0 L8 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>

      {/* REC indicator (live only) */}
      {showLive && (
        <div className="vf__rec t-mono" aria-hidden="true">
          <span className="vf__rec-dot" />
          REC
        </div>
      )}

      {/* Caption on fallback */}
      {showFallback && !permissionDenied && (
        <p className="vf__caption">{requesting ? 'Asking the camera politely...' : 'Tap the shutter to begin.'}</p>
      )}
      {showFallback && permissionDenied && (
        <p className="vf__caption">I cannot see without the camera.</p>
      )}

      <style>{`
        .vf {
          position: relative;
          width: 100%;
          max-width: 480px;
          aspect-ratio: 3 / 4;
          margin-inline: auto;
          background: var(--smoke);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow:
            inset 0 0 0 1px var(--border-subtle),
            0 0 60px color-mix(in oklch, var(--ember) 6%, transparent);
        }
        .vf__video, .vf__captured, .vf__fallback {
          position: absolute; inset: 0;
          width: 100%; height: 100%; object-fit: cover; display: block;
          transition: opacity 240ms var(--ease-standard);
        }
        .vf__video {
          /* Stacked under the captured/fallback layers; revealed via opacity. */
          background: var(--midnight);
        }
        .vf__fallback-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(180deg in oklch,
            color-mix(in oklch, var(--midnight) 60%, transparent) 0%,
            transparent 35%, transparent 60%,
            color-mix(in oklch, var(--midnight) 70%, transparent) 100%);
          pointer-events: none;
        }
        .vf__corner {
          position: absolute; width: 24px; height: 24px;
          color: color-mix(in oklch, var(--bone) 35%, transparent);
        }
        .vf__corner--tl { top: 16px; left: 16px; }
        .vf__corner--tr { top: 16px; right: 16px; transform: scaleX(-1); }
        .vf__corner--bl { bottom: 16px; left: 16px; transform: scaleY(-1); }
        .vf__corner--br { bottom: 16px; right: 16px; transform: scale(-1, -1); }
        .vf__rec {
          position: absolute;
          top: 18px; right: 18px;
          display: inline-flex; align-items: center; gap: 6px;
          color: color-mix(in oklch, var(--bone) 60%, transparent);
        }
        .vf__rec-dot {
          width: 6px; height: 6px; border-radius: 999px;
          background: var(--ember);
          animation: vf-rec 2.4s ease-in-out infinite;
        }
        @keyframes vf-rec {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
        .vf__caption {
          position: absolute;
          left: 0; right: 0; bottom: 28px;
          text-align: center;
          font: italic 14px/1.4 var(--font-rowan);
          color: color-mix(in oklch, var(--bone) 80%, transparent);
          padding: 0 28px;
          letter-spacing: -0.005em;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
});
