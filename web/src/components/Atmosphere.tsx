import { useEffect, useRef } from 'react';
import { img } from '../lib/cdn';

const HAND_BOTTLE = 'https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/2a7fc506-ecc5-4c2b-bc40-f8ac223b8696.png';
const BARTOP = 'https://i.mscdn.ai/42da083b-07b3-4d8f-89c6-1c3ba8419e38/generated-images/b99cf7d2-b486-4210-a8de-c3705f414684.png';

// Desktop-only ambient atmosphere. Two chiaroscuro hero photos floating at
// corners, masked into the canvas, with subtle mouse parallax. Hidden on
// mobile (where the viewfinder occupies the viewport).
export function Atmosphere() {
  const tlRef = useRef<HTMLImageElement | null>(null);
  const brRef = useRef<HTMLImageElement | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 760) return;

    const onMove = (e: MouseEvent) => {
      target.current.x = (e.clientX / window.innerWidth - 0.5) * 8;
      target.current.y = (e.clientY / window.innerHeight - 0.5) * 8;
    };

    const tick = () => {
      // Lerp toward target for a settled feel rather than rigid chase.
      current.current.x += (target.current.x - current.current.x) * 0.04;
      current.current.y += (target.current.y - current.current.y) * 0.04;
      const tx = current.current.x;
      const ty = current.current.y;
      if (tlRef.current) tlRef.current.style.transform = `translate(${tx}px, ${ty}px)`;
      if (brRef.current) brRef.current.style.transform = `translate(${-tx}px, ${-ty}px)`;
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="atmosphere" aria-hidden="true">
      <img ref={tlRef} className="atmosphere__img atmosphere__img--tl" src={img(HAND_BOTTLE, 800)} alt="" />
      <img ref={brRef} className="atmosphere__img atmosphere__img--br" src={img(BARTOP, 800)} alt="" />
      <style>{`
        .atmosphere {
          position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
        }
        .atmosphere__img {
          position: absolute;
          width: 60vmin; max-width: 720px;
          opacity: 0.085;
          filter: blur(0.5px) saturate(1.05);
          mix-blend-mode: lighten;
          user-select: none;
          transition: transform 60ms linear;
        }
        .atmosphere__img--tl {
          top: -12vh; left: -8vw;
          mask-image: radial-gradient(ellipse at 70% 70%, black 0%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse at 70% 70%, black 0%, transparent 75%);
        }
        .atmosphere__img--br {
          bottom: -10vh; right: -8vw;
          mask-image: radial-gradient(ellipse at 30% 30%, black 0%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse at 30% 30%, black 0%, transparent 75%);
        }
        @media (max-width: 760px) {
          .atmosphere { display: none; }
        }
        [data-theme='day'] .atmosphere__img { opacity: 0.05; mix-blend-mode: multiply; }
      `}</style>
    </div>
  );
}
