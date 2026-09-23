// Picks the single letter shown on a placeholder tile for an entry with no
// photo.
//
// Naively using name[0] breaks on the most common wine naming convention there
// is: leading with the vintage. "2022 Toscana Rosso" yields "2", which reads as
// a glitch. So skip anything that is not a letter, and fall back to the
// producer when the name has no letters at all (e.g. "2022").
//
// Returns null when no letter can be found anywhere, so the caller can render a
// glyph instead of an empty box.

function firstLetter(s?: string | null): string | null {
  if (!s) return null;
  // First Unicode letter, so accented and non-Latin names work too.
  const m = s.match(/\p{L}/u);
  return m ? m[0].toUpperCase() : null;
}

export function monogramFor(entry: {
  name: string;
  producer?: string;
}): string | null {
  // Name first: it is the text shown most prominently on the tile, so the
  // letter matching it reads as connected rather than arbitrary.
  return firstLetter(entry.name) ?? firstLetter(entry.producer);
}
