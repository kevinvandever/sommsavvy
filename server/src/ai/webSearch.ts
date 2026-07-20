import { config } from '../config';

// Provider-neutral web search used to enrich reverse-scan cards. Wired to the
// You.com Web Search API by default, but the endpoint is configurable and the
// response parsing is defensive, so the provider can change without touching
// callers. The one hard contract: this function never throws. Any failure —
// missing key, non-2xx, malformed body, timeout — resolves to an empty result
// list, which callers treat as "no enrichment available".

export interface WebSearchArgs {
  query: string;
  maxResults?: number;
  timeoutMs?: number;
}

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

// ---- Per-window call budget (process-local, rolling 60s) ----
// A backstop against runaway spend if many scans arrive at once. Kept in
// memory intentionally: it is a soft cap, not an accounting system.

const WINDOW_MS = 60_000;
let windowStart = Date.now();
let windowCount = 0;

function canSearch(): boolean {
  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  return windowCount < config.scanEnrich.callsPerMin;
}

function recordSearch(): void {
  windowCount += 1;
}

/** True when a provider key is configured. Callers gate on this to avoid work. */
export function isWebSearchConfigured(): boolean {
  return !!config.webSearchApiKey;
}

/** True when the per-window budget still has room. Exposed for the caller's gate. */
export function hasSearchBudget(): boolean {
  return canSearch();
}

/**
 * Run a web search. Returns up to `maxResults` results, or an empty list on
 * any failure. Never throws.
 */
export async function webSearch(args: WebSearchArgs): Promise<{ results: WebSearchResult[] }> {
  if (!config.webSearchApiKey) return { results: [] };
  if (!canSearch()) return { results: [] };

  const maxResults = args.maxResults ?? config.scanEnrich.maxResults;
  const timeoutMs = args.timeoutMs ?? config.scanEnrich.timeoutMs;

  const url = new URL(config.webSearchEndpoint);
  url.searchParams.set('query', args.query);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    recordSearch();
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': config.webSearchApiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) return { results: [] };

    const body = (await res.json()) as unknown;
    return { results: parseWebSearchResults(body, maxResults) };
  } catch {
    // Network error, abort/timeout, or JSON parse failure — enrichment is
    // optional, so degrade silently to no results.
    return { results: [] };
  } finally {
    clearTimeout(timer);
  }
}

// Locate the array of result objects wherever the provider puts it. You.com's
// v1 API returns `results` as an OBJECT of sub-arrays (e.g. results.web); the
// classic API returned a top-level `hits` array; others use a top-level
// `results` array. We check the known shapes, then fall back to the first
// array of objects we find one level down. Exported for testing.
export function extractRawList(obj: Record<string, unknown>): unknown[] {
  // Top-level arrays.
  if (Array.isArray(obj.results)) return obj.results;
  if (Array.isArray(obj.hits)) return obj.hits;

  // `results` as an object of sub-arrays (You.com v1).
  const nested = obj.results;
  if (nested && typeof nested === 'object') {
    const n = nested as Record<string, unknown>;
    // Prefer web results, then other known buckets.
    for (const key of ['web', 'news', 'results', 'items', 'hits']) {
      if (Array.isArray(n[key])) return n[key] as unknown[];
    }
    // Fallback: the first array value present.
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) return v as unknown[];
    }
  }

  return [];
}

// ---- Defensive response parsing ----
// You.com has shipped a few response shapes over time and other providers
// differ. Rather than bind to one, pull results from the common containers
// and coalesce the text fields we care about. Exported for unit testing.

export function parseWebSearchResults(body: unknown, maxResults: number): WebSearchResult[] {
  if (!body || typeof body !== 'object') return [];

  const rawList = extractRawList(body as Record<string, unknown>);

  const out: WebSearchResult[] = [];
  for (const item of rawList as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;

    const title = typeof r.title === 'string' ? r.title : '';
    const url = typeof r.url === 'string' ? r.url : '';

    // Coalesce the text field across provider shapes. You.com returns
    // `snippets` (array of passages); others use `snippet`, `description`,
    // `passages` (array), or `content`/`text`.
    const joinStrings = (v: unknown): string =>
      Array.isArray(v)
        ? v.filter((s): s is string => typeof s === 'string').join(' ')
        : '';
    const snippet =
      joinStrings(r.snippets) ||
      joinStrings(r.passages) ||
      (typeof r.snippet === 'string' ? r.snippet : '') ||
      (typeof r.description === 'string' ? r.description : '') ||
      (typeof r.content === 'string' ? r.content : '') ||
      (typeof r.text === 'string' ? r.text : '');

    if (!title && !snippet) continue;
    out.push({ title, snippet, url });
    if (out.length >= maxResults) break;
  }

  return out;
}
