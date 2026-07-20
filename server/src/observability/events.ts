// Structured event logging for launch instrumentation.
// Emits single-line JSON to stdout, readable in Railway logs.

export const SCAN_STARTED = 'scan_started';
export const SCAN_SUCCEEDED = 'scan_succeeded';
export const SCAN_FAILED = 'scan_failed';
export const SCAN_ENRICHED = 'scan_enriched';
export const CELLAR_SAVED = 'cellar_saved';
export const SIGNED_UP = 'signed_up';

export function logEvent(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...data }));
}
