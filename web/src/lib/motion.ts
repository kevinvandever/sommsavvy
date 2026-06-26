// Motion tokens. Imported wherever motion is used so timings stay consistent.

export const EASE = {
  standard: [0.32, 0.72, 0.24, 1] as [number, number, number, number],
  entrance: [0.18, 0.89, 0.32, 1.05] as [number, number, number, number],
  exit: [0.4, 0, 0.6, 1] as [number, number, number, number],
  glide: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

export const DUR = {
  micro: 0.18,
  fast: 0.28,
  std: 0.38,
  slow: 0.56,
  hero: 0.8,
  scan: 1.0,
};

export const SPRING = {
  sheet: { type: 'spring' as const, stiffness: 240, damping: 30, mass: 1 },
  bounce: { type: 'spring' as const, stiffness: 320, damping: 28, mass: 1 },
  soft: { type: 'spring' as const, stiffness: 180, damping: 26, mass: 1 },
};

// Single-shot reduced-motion check.
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
