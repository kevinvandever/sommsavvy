import { reverseScanInternal, type ReverseScanInput, type ScanResult } from './common/reverseScanInternal';

// Re-export the types so existing imports from this module still resolve.
export type { ScanResult, ReverseScanInput };

// Reverse Scan endpoint wrapper. Delegates entirely to the internal function
// which uses the ambient request context for auth, streaming, and guardrails.
// This preserves the existing sseMethod contract unchanged while making the
// core logic callable by smartScan or any other router.
export async function reverseScan(input: ReverseScanInput): Promise<ScanResult> {
  return reverseScanInternal(input);
}
