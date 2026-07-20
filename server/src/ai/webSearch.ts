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

// ---- Defensive response parsing ----
// You.com has shipped a few response shapes over time and other providers
// differ. Rather than bind to one, pull results from the common containers
// (`results` / `hits`) and coalesce the text fields we care about.
// Exported for unit testing.

export function parseWebSearchResults(body: unknown, maxResults: number): WebSearchResult[] {
  if (!body || typeof body !== 'object') return [];

  const obj = body as Record<string, unknown>;
  const rawList =
    (Array.isArray(obj.results) && obj.results) ||
    (Array.isArray(obj.hits) && obj.hits) ||
    [];

  const out: WebSearchResult[] = [];
  for (const item of rawList as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;

    const title = typeof r.title === 'string' ? r.title : '';
    const url = typeof r.url === 'string' ? r.url : '';

    // `snippets` is an array of passages on You.com; fall back to a single
    // `snippet` or `description` string from other providers.
    let snippet = '';
    if (Array.isArray(r.snippets)) {
      snippet = (r.snippets as unknown[])
        .filter((s): s is string => typeof s === 'string')
        .join(' ');
    } else if (typeof r.snippet === 'string') {
      snippet = r.snippet;
    } else if (typeof r.description === 'string') {
      snippet = r.description;
    }

    if (!title && !snippet) continue;
    out.push({ title, snippet, url });
    if (out.length >= maxResults) break;
  }

  return out;
}
