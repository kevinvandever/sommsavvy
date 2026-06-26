import type { ReactNode } from 'react';

interface Props {
  text: string;
  aside?: string | null;
  className?: string;
  children?: ReactNode;
}

// Renders an editorial body paragraph with an optional faux-snobby aside,
// inline-italic-Rowan, em-dashed off the main thought. The visual setup is
// the joke. Em-dashes use a true em-dash (—), not double hyphens.
export function MonocleText({ text, aside, className = 't-why' }: Props) {
  if (!aside) {
    return <p className={className}>{text}</p>;
  }
  // Insert the aside near the end of the text. We keep the original text
  // intact so the model's intent is preserved, then add the aside in italic
  // Rowan, em-dashed, before the final period.
  const trimmed = text.trim().replace(/[.!?]+$/, '');
  return (
    <p className={className}>
      {trimmed}
      <span className="t-aside"> &mdash; {aside.trim().replace(/[.!?]+$/, '')}.</span>
    </p>
  );
}
