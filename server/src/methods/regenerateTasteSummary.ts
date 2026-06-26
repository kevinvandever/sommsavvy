import { auth } from '../runtime';
import { runTasteSummaryRegen } from './common/regenerateTasteSummaryInternal';

// Exposed so the frontend "Refresh" button on the profile page can request a
// regeneration. Also called fire-and-forget from cellar mutation methods.
export async function regenerateTasteSummary() {
  if (!auth.userId) {
    throw new Error('Sign in to refresh your taste profile.');
  }

  await runTasteSummaryRegen(auth.userId);

  return { ok: true };
}
