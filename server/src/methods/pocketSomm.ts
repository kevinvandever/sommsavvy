import { pocketSommInternal, type PocketSommInput, type PocketSommOutput, type Recommendation } from './common/pocketSommInternal';

// Re-export the types so existing imports from this module still resolve.
export type { PocketSommInput, PocketSommOutput, Recommendation };

// Pocket Somm endpoint wrapper. Delegates entirely to the internal function
// which uses the ambient request context for auth, streaming, and guardrails.
// This preserves the existing sseMethod contract unchanged while making the
// core logic callable by smartScan or any other router.
export async function pocketSomm(input: PocketSommInput): Promise<PocketSommOutput> {
  return pocketSommInternal(input);
}
