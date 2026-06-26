import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '@mindstudio-ai/interface';
import { Sheet } from './Sheet';
import { DigitBoxes } from './DigitBoxes';
import { IconLoader2, IconCheck } from '@tabler/icons-react';
import { EASE, DUR } from '../lib/motion';

interface Props {
  open: boolean;
  onClose: () => void;
  // Optional URL of the bottle the user was about to save, for the
  // "monogram → bottle" morph at success.
  bottleThumbnailUrl?: string;
  onSuccess?: () => void;
}

// Typographic monogram (matches Header). Used as the auth-sheet anchor.
function AuthMonogram({ size = 56 }: { size?: number }) {
  return (
    <span
      className="auth-mono"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.62 }}
    >
      <span className="auth-mono__s">S</span>
      <style>{`
        .auth-mono {
          display: inline-grid;
          place-items: center;
          border-radius: 12px;
          background: linear-gradient(140deg in oklch,
            color-mix(in oklch, var(--smoke) 80%, var(--midnight)),
            color-mix(in oklch, var(--smoke) 95%, var(--ember) 5%));
          border: 1px solid color-mix(in oklch, var(--ember) 22%, var(--border-subtle));
          box-shadow: 0 0 24px color-mix(in oklch, var(--ember) 22%, transparent);
          line-height: 1;
          font-family: var(--font-rowan);
          font-style: italic;
          font-weight: 500;
          color: var(--ember);
        }
        .auth-mono__s {
          color: var(--ember);
          text-shadow:
            0 1px 0 color-mix(in oklch, var(--midnight) 70%, transparent),
            0 0 16px color-mix(in oklch, var(--ember) 45%, transparent);
          letter-spacing: -0.04em;
          transform: translateY(-1px);
          display: inline-block;
        }
      `}</style>
    </span>
  );
}

export function AuthSheet({ open, onClose, bottleThumbnailUrl, onSuccess }: Props) {
  const [step, setStep] = useState<'email' | 'code' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  // Reset on close.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('email');
        setEmail('');
        setVerificationId(null);
        setError('');
        setSending(false);
        setVerifying(false);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [open]);

  const sendCode = async () => {
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Looks like a typo in that email.');
      return;
    }
    setSending(true);
    try {
      const { verificationId } = await auth.sendEmailCode(email.trim());
      setVerificationId(verificationId);
      setStep('code');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'rate_limited') setError('Too many attempts. Try again later.');
      else setError(e.message || 'Could not send the code.');
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async (code: string) => {
    if (!verificationId) return;
    setError('');
    setVerifying(true);
    try {
      await auth.verifyEmailCode(verificationId, code);
      setStep('success');
      // Hold the success state briefly, then dismiss.
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1300);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setVerifying(false);
      if (e.code === 'invalid_code') setError('Wrong code. Try again.');
      else if (e.code === 'verification_expired') setError('Code expired. Send a new one.');
      else if (e.code === 'max_attempts_exceeded') setError('Too many tries. Send a new code.');
      else setError(e.message || 'Could not verify.');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} layer={80}>
      <div className="auth">
        {/* Top anchor: brass-S monogram, morphs to bottle thumb on success */}
        <motion.div
          className="auth__anchor"
          animate={{
            width: step === 'success' ? 56 : 32,
            height: step === 'success' ? 56 : 32,
            rotate: step === 'success' ? -6 : 0,
            borderRadius: step === 'success' ? 12 : 6,
          }}
          transition={{ duration: DUR.slow, ease: EASE.glide }}
        >
          <AnimatePresence mode="wait">
            {step === 'success' && bottleThumbnailUrl ? (
              <motion.img
                key="bottle"
                src={bottleThumbnailUrl}
                alt=""
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32 }}
                className="auth__anchor-img"
              />
            ) : (
              <motion.div
                key="mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32 }}
                className="auth__anchor-mono"
              >
                <AuthMonogram size={step === 'success' ? 56 : 32} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 'email' && (
            <motion.div
              key="email"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: DUR.std, ease: EASE.standard }}
            >
              <h2 className="t-display auth__title">Let&rsquo;s start your cellar.</h2>
              <p className="t-body auth__subline">Email and a six-digit code. No passwords.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendCode();
                }}
                className="auth__form"
              >
                <input
                  type="email"
                  className="input"
                  placeholder="you@somewhere.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  autoComplete="email"
                  disabled={sending}
                />
                <button
                  type="submit"
                  className="btn-primary auth__send"
                  disabled={sending || !email.trim()}
                >
                  {sending ? <IconLoader2 className="spin" size={18} /> : 'Send code'}
                </button>
              </form>
              {error && <p className="auth__error">{error}</p>}
            </motion.div>
          )}

          {step === 'code' && (
            <motion.div
              key="code"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: DUR.std, ease: EASE.standard }}
            >
              <h2 className="t-headline auth__title-sm">Check your email.</h2>
              <p className="t-caption auth__sent-line">
                Sent to <span className="t-aside">{email}</span>. Code expires in ten minutes.
              </p>
              <DigitBoxes onComplete={verifyCode} disabled={verifying} errored={!!error} />
              {error && <p className="auth__error">{error}</p>}
              <div className="auth__resend">
                <button
                  type="button"
                  className="btn-tertiary"
                  onClick={() => {
                    setStep('email');
                    setError('');
                  }}
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  className="btn-tertiary"
                  onClick={async () => {
                    setError('');
                    await sendCode();
                  }}
                  disabled={sending}
                >
                  Resend code
                </button>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: DUR.std, ease: EASE.standard }}
              className="auth__success"
            >
              <h2 className="t-display t-display--italic auth__success-title">Lovely choice.</h2>
              <motion.div
                className="auth__check"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.24, ease: EASE.entrance, delay: 0.2 }}
              >
                <IconCheck size={20} stroke={2} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <style>{`
          .auth { padding: 8px 4px 16px; text-align: center; }
          .auth__anchor {
            margin: 0 auto 18px;
            display: grid; place-items: center;
            position: relative;
            overflow: hidden;
            box-shadow: 0 0 24px color-mix(in oklch, var(--ember) 12%, transparent);
          }
          .auth__anchor-img {
            position: absolute;
            inset: 0;
            width: 100%; height: 100%;
            object-fit: cover;
          }
          .auth__anchor-mono {
            display: grid;
            place-items: center;
          }
          .auth__title {
            font-size: clamp(28px, 6vw, 36px);
            margin-bottom: 8px;
            color: var(--parchment);
          }
          .auth__title-sm {
            color: var(--parchment);
            margin-bottom: 6px;
          }
          .auth__subline { color: var(--bone); margin-bottom: 18px; }
          .auth__sent-line { margin-bottom: 14px; color: var(--bone); }
          .auth__form { display: flex; flex-direction: column; gap: 12px; align-items: stretch; }
          .auth__send { width: 100%; min-width: 180px; }
          .auth__error {
            color: color-mix(in oklch, var(--bordeaux) 80%, var(--bone));
            font: 13px var(--font-geist);
            margin-top: 10px;
          }
          .auth__resend {
            display: flex; justify-content: center; gap: 12px;
            margin-top: 10px;
            flex-wrap: wrap;
          }
          .auth__success { padding: 20px 0 8px; position: relative; }
          .auth__success-title {
            color: var(--parchment);
            line-height: 1.04;
          }
          .auth__check {
            margin: 16px auto 0;
            width: 36px; height: 36px;
            border-radius: 999px;
            background: color-mix(in oklch, var(--verde) 30%, transparent);
            color: var(--verde);
            display: grid; place-items: center;
          }
        `}</style>
      </div>
    </Sheet>
  );
}
