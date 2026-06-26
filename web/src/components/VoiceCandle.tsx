import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { platform } from '@mindstudio-ai/interface';
import { EASE, DUR } from '../lib/motion';
import { IconX, IconLoader2 } from '@tabler/icons-react';
import { api } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
  // Called with the final transcribed text once the audio is uploaded
  // and the backend transcription has returned.
  onDone: (text: string) => void;
}

type Stage = 'listening' | 'transcribing' | 'error';

// Full-screen voice capture overlay. A breathing candle flame, audio-amplitude
// scaling, and a single audio recording that gets uploaded to the backend
// for high-quality transcription on Done. The flame breathes with the
// real-time amplitude, the user taps Done when finished, and the actual
// transcription is performed server-side by ElevenLabs Scribe v2 — way
// more accurate and consistent than browser-native Web Speech.
export function VoiceCandle({ open, onClose, onDone }: Props) {
  const [stage, setStage] = useState<Stage>('listening');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setStage('listening');
    setError(null);
    setDuration(0);
    chunksRef.current = [];
    startTimeRef.current = Date.now();

    let cancelled = false;

    // Update duration counter once a second.
    tickRef.current = window.setInterval(() => {
      setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    navigator.mediaDevices
      ?.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // Choose the best mime type the browser supports. Safari prefers
        // mp4/aac, Chrome and Firefox prefer webm/opus. Both work fine
        // with the ElevenLabs transcriber.
        const mime = pickMimeType();
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        // Chunk every 250ms. iOS Safari is unreliable about firing
        // ondataavailable at all without a timeslice — this guarantees
        // we accumulate chunks during the recording instead of all at
        // stop time, and gives us a useful blob even on short recordings.
        recorder.start(250);
        recorderRef.current = recorder;

        // NOTE: Previously we wired the stream into an AudioContext for
        // a real-time amplitude visualization on the flame. On iOS Safari,
        // creating an AudioContext source from a stream that is also being
        // recorded silences the recording (the audio routes through the
        // AudioContext instead of into the recorder). Removed entirely —
        // the flame still breathes via its CSS keyframe animation.
      })
      .catch(() => {
        setStage('error');
        setError('I cannot hear without the microphone.');
      });

    return () => {
      cancelled = true;
      if (tickRef.current) window.clearInterval(tickRef.current);
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const handleDone = async () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      onClose();
      return;
    }

    setStage('transcribing');

    // Stop recording and wait briefly for any trailing dataavailable.
    // On iOS, the final chunk sometimes fires AFTER onstop, so we settle
    // on a small delay rather than trusting onstop to fire last.
    const blob = await new Promise<Blob | null>((resolve) => {
      const finish = () => {
        if (chunksRef.current.length === 0) {
          resolve(null);
          return;
        }
        const type = recorder.mimeType || 'audio/webm';
        resolve(new Blob(chunksRef.current, { type }));
      };
      recorder.onstop = () => {
        // Give iOS one more tick to flush any trailing data.
        setTimeout(finish, 120);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });

    if (!blob || blob.size < 1000) {
      // Effectively nothing recorded — likely the user tapped Done before
      // saying anything, or the mic was muted.
      setStage('error');
      setError('Did not catch anything. Try again, or type instead?');
      return;
    }

    try {
      // Upload the recording to the platform CDN, then ask the backend
      // to transcribe with ElevenLabs Scribe v2.
      const fileName = `voice-${Date.now()}.${extFor(blob.type)}`;
      const file = new File([blob], fileName, { type: blob.type });
      const audioUrl = await platform.uploadFile(file);
      const { text } = await api.transcribeVoice({ audioUrl });
      const trimmed = (text || '').trim();
      if (!trimmed) {
        setStage('error');
        setError('Could not catch that. Try again, or type instead?');
        return;
      }
      onDone(trimmed);
    } catch (err) {
      console.error('Voice transcription failed', err);
      setStage('error');
      setError('Could not catch that. Try again, or type instead?');
    }
  };

  const minutes = Math.floor(duration / 60);
  const seconds = (duration % 60).toString().padStart(2, '0');
  const timeLabel = `${minutes}:${seconds}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="candle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.std, ease: EASE.standard }}
          role="dialog"
          aria-label="Voice input"
        >
          <button className="candle__close" onClick={onClose} aria-label="Cancel">
            <IconX size={22} stroke={1.5} />
          </button>

          <motion.div
            className="candle__flame"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: DUR.slow, ease: EASE.entrance }}
          >
            <svg viewBox="0 0 120 200" aria-hidden="true">
              <defs>
                <radialGradient id="flame-halo" cx="50%" cy="60%" r="50%">
                  <stop offset="0%" stopColor="#E89B3C" stopOpacity="0.5" />
                  <stop offset="40%" stopColor="#E89B3C" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#E89B3C" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="flame-body" cx="50%" cy="70%" r="50%">
                  <stop offset="0%" stopColor="#FFD89B" />
                  <stop offset="50%" stopColor="#E89B3C" />
                  <stop offset="100%" stopColor="#7A1F2B" />
                </radialGradient>
                <radialGradient id="flame-core" cx="50%" cy="75%" r="35%">
                  <stop offset="0%" stopColor="#FFF4E1" />
                  <stop offset="60%" stopColor="#FFD89B" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#FFD89B" stopOpacity="0" />
                </radialGradient>
                <filter id="flame-blur">
                  <feGaussianBlur stdDeviation="0.6" />
                </filter>
              </defs>
              <ellipse cx="60" cy="120" rx="50" ry="80" fill="url(#flame-halo)" />
              <path
                d="M60 30 C 45 70, 25 100, 30 140 C 32 170, 50 190, 60 190 C 70 190, 88 170, 90 140 C 95 100, 75 70, 60 30 Z"
                fill="url(#flame-body)"
                filter="url(#flame-blur)"
              />
              <ellipse cx="60" cy="140" rx="14" ry="32" fill="url(#flame-core)" />
            </svg>
          </motion.div>

          <div className="candle__status" aria-live="polite">
            {stage === 'error' ? (
              <p className="candle__error">{error}</p>
            ) : stage === 'transcribing' ? (
              <p className="candle__placeholder">
                <IconLoader2 size={18} className="spin" /> One moment, listening back...
              </p>
            ) : (
              <>
                <p className="candle__placeholder">Speak when you are ready.</p>
                <p className="candle__time t-mono">{timeLabel}</p>
              </>
            )}
          </div>

          <button
            className="btn-primary candle__done"
            onClick={handleDone}
            disabled={stage !== 'listening'}
          >
            {stage === 'transcribing' ? 'Transcribing...' : 'Done'}
          </button>

          <style>{`
            .candle {
              position: fixed; inset: 0;
              z-index: 200;
              background: var(--midnight);
              backdrop-filter: blur(20px);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-around;
              padding: 64px 24px;
              padding-top: max(64px, env(safe-area-inset-top, 0px));
              padding-bottom: max(64px, env(safe-area-inset-bottom, 0px));
            }
            .candle__close {
              position: absolute;
              top: 24px;
              left: 24px;
              width: 44px; height: 44px;
              border-radius: 999px;
              background: var(--smoke);
              color: var(--bone);
              border: 1px solid var(--border-subtle);
              display: grid; place-items: center;
              transition: color 180ms var(--ease-standard);
            }
            .candle__close:hover { color: var(--ember); }
            .candle__flame {
              width: 120px; height: 200px;
              filter: drop-shadow(0 0 40px color-mix(in oklch, var(--ember) 40%, transparent));
              transform-origin: 50% 100%;
              animation: flame-breathe 1.8s ease-in-out infinite;
            }
            .candle__flame svg { width: 100%; height: 100%; display: block; }
            @keyframes flame-breathe {
              0%, 100% { transform: scale(1); }
              50%      { transform: scale(1.05); }
            }
            .candle__status {
              max-width: 600px;
              text-align: center;
              min-height: 4em;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
            }
            .candle__placeholder {
              font: italic 22px/1.4 var(--font-rowan);
              color: color-mix(in oklch, var(--bone) 60%, transparent);
              display: inline-flex;
              align-items: center;
              gap: 10px;
            }
            .candle__time {
              font-size: 14px;
              color: color-mix(in oklch, var(--bone) 40%, transparent);
              letter-spacing: 0.04em;
            }
            .candle__error {
              color: color-mix(in oklch, var(--bordeaux) 70%, var(--bone));
              font-size: 18px;
              font-family: var(--font-rowan);
              font-style: italic;
            }
            .candle__done {
              min-width: 160px;
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Pick the first MIME type the browser supports for MediaRecorder.
// Safari is happiest with audio/mp4; Chrome/Firefox happiest with webm.
function pickMimeType(): string | null {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ];
  if (typeof MediaRecorder === 'undefined') return null;
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

// Map a MIME type to a sensible file extension for upload naming.
function extFor(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('aac')) return 'aac';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}
