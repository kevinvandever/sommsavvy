// CDN transform helpers. Always pass dpr=3 for retina sharpness.

export function img(url: string | undefined, w: number, h?: number, fit: 'cover' | 'crop' = 'cover'): string | undefined {
  if (!url) return undefined;
  const params = new URLSearchParams();
  params.set('w', String(w));
  if (h) params.set('h', String(h));
  params.set('fit', fit);
  params.set('fm', 'webp');
  params.set('dpr', '3');
  // If url already has a query, append; otherwise add fresh.
  return url.includes('?') ? `${url}&${params.toString()}` : `${url}?${params.toString()}`;
}
