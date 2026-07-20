import { auth, mindstudio } from '../runtime';
import { CellarEntries, type CellarEntry } from './tables/cellarEntries';
import { Users } from './tables/users';
import { VOICE_RULES, DEPTH_GUIDANCE, type Depth } from './common/voice';
import { config } from '../config';
import type { Hydrated } from '../db/adapter';

// searchCellar interprets a natural-language query against the caller's own
// cellar and returns a ranked subset with a short reason per entry. The model
// only selects and orders IDs from the candidate set it is given; full entry
// objects are resolved server-side from the caller's rows. That structurally
// guarantees results are always the user's own bottles and never fabricated.
//
// When interpretation is unavailable (no provider), errors, or times out, the
// existing substring keyword filter serves the same query so search never
// regresses.

type Entry = Hydrated<CellarEntry>;

export interface SearchCellarInput {
  query: string;
  kind?: 'wine' | 'beer' | 'spirits';
  owned?: boolean;
}

export interface CellarMatch {
  entry: Entry;
  reason: string;
}

export interface SearchCellarResult {
  matches: CellarMatch[];
  usedFallback: boolean;
}

export async function searchCellar(input: SearchCellarInput): Promise<SearchCellarResult> {
  if (!auth.userId) {
    throw new Error('Sign in to search your cellar.');
  }
  const userId = auth.userId;

  // --- Load the caller's cellar, newest first (same narrowing as listCellar). ---
  let candidates = await CellarEntries.filter(
    (e, $) => e.userId === $.userId,
    { userId },
  )
    .sortBy((e) => e.savedAt)
    .reverse();

  // --- Apply the active filter chips to form the candidate set. ---
  if (input.kind) {
    candidates = candidates.filter((e) => e.kind === input.kind);
  }
  if (input.owned) {
    candidates = candidates.filter((e) => e.owned === true);
  }

  const query = (input.query || '').trim();

  // Empty query: no interpretation. Return the filtered set as-is (the
  // frontend handles empty-query display, but we stay correct if called).
  if (!query) {
    return { matches: candidates.map((entry) => ({ entry, reason: '' })), usedFallback: false };
  }

  // Nothing to search.
  if (candidates.length === 0) {
    return { matches: [], usedFallback: false };
  }

  // Cap the candidate set sent to the model; oversized cellars truncate to
  // the most recent (candidates are already newest-first).
  const capped = candidates.slice(0, config.cellarSearch.maxCandidates);

  try {
    const matches = await withTimeout(
      interpret(query, capped, userId),
      config.cellarSearch.timeoutMs,
    );
    return { matches, usedFallback: false };
  } catch {
    // Provider error, timeout, or unconfigured provider — fall back to the
    // substring keyword filter over the same candidate set.
    return { matches: keywordFallback(query, candidates), usedFallback: true };
  }
}

// --- Interpretation via the AI text capability ---

async function interpret(query: string, candidates: Entry[], userId: string): Promise<CellarMatch[]> {
  // Light context: the user's depth voice and taste summary. Neither overrides
  // the explicit request.
  let depth: Depth = 'enthusiast';
  let tasteSummary: string | undefined;
  const me = await Users.get(userId);
  if (me?.depthPreference) depth = me.depthPreference as Depth;
  if (me?.tasteSummary) tasteSummary = me.tasteSummary;

  // Compact projection: only the fields interpretation needs. This is the only
  // cellar data sent to the model.
  const projection = candidates.map((e) => ({
    id: e.id,
    name: e.name,
    producer: e.producer ?? null,
    region: e.region ?? null,
    kind: e.kind,
    vintage: e.vintage ?? null,
    occasion: e.occasion ?? null,
    pairings: e.pairings ?? [],
    whyText: e.whyText ?? null,
    notes: e.notes ?? null,
  }));

  const prompt = `You are SommSavvy, a pocket sommelier helping someone find something from the bottles they ALREADY OWN. Below is the user's request and a list of their saved cellar entries.

${VOICE_RULES}

${DEPTH_GUIDANCE[depth]}

${tasteSummary ? `User's taste profile (light context only, do not override the explicit request):\n${tasteSummary}` : ''}

The user's request:
"${query}"

Their cellar (each entry has an id):
${JSON.stringify(projection)}

Instructions:
- Select the entries that genuinely fit the request. Consider kind, region, style, the editorial "whyText", the pairings, the occasion, and the user's own "notes".
- Rank the best fits first.
- Return ONLY entries that actually fit. If nothing fits, return an empty list. Do not force a stretch.
- For each selected entry, write "reason": one short sentence, in the depth-appropriate voice, on why it fits this request.
- Select ONLY from the ids provided. Never invent an id or a bottle.
- NEVER include a numeric rating or score.

Return ONLY a JSON object of this shape:
{ "matches": [ { "id": "<one of the provided ids>", "reason": "<one short sentence>" } ] }

No prose, no markdown fences.`;

  const { content } = await mindstudio.generateText({
    message: prompt,
    modelOverride: { temperature: 0.4, maxResponseTokens: 1500 },
    structuredOutputType: 'json',
    structuredOutputExample: JSON.stringify({
      matches: [{ id: candidates[0]!.id, reason: 'A structured red that stands up to rich fish.' }],
    }),
  });

  const parsed = (typeof content === 'string' ? JSON.parse(content) : content) as {
    matches?: Array<{ id?: unknown; reason?: unknown }>;
  };

  return resolveMatches(parsed.matches ?? [], candidates);
}

// Map the model's selected ids back to the caller's own entries. Drops any id
// not in the candidate set (hallucination guard), de-duplicates, and preserves
// the model's ordering. Exported for tests.
export function resolveMatches(
  selected: Array<{ id?: unknown; reason?: unknown }>,
  candidates: Entry[],
): CellarMatch[] {
  const byId = new Map(candidates.map((e) => [e.id, e]));
  const out: CellarMatch[] = [];
  const seen = new Set<string>();

  for (const m of selected) {
    if (typeof m?.id !== 'string') continue;
    if (seen.has(m.id)) continue;
    const entry = byId.get(m.id); // drops any hallucinated id not in the set
    if (!entry) continue;
    seen.add(m.id);
    out.push({
      entry,
      reason: typeof m.reason === 'string' ? m.reason.trim() : '',
    });
  }

  return out;
}

// --- Substring keyword fallback (mirrors listCellar's search) ---

export function keywordFallback(query: string, candidates: Entry[]): CellarMatch[] {
  const needle = query.toLowerCase();
  return candidates
    .filter((e) => {
      const hay = [e.name, e.producer, e.region, e.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    })
    .map((entry) => ({ entry, reason: '' }));
}

// --- Timeout helper ---

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('cellar_search_timeout')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
