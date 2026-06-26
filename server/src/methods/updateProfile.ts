import { auth } from '../runtime';
import { Users } from './tables/users';
import { runTasteSummaryRegen } from './common/regenerateTasteSummaryInternal';

interface UpdateProfileInput {
  displayName?: string;
  depthPreference?: 'beginner' | 'enthusiast' | 'expert';
  // Pass an empty string to clear; pass omitted to leave unchanged.
  tasteSeed?: string;
}

export async function updateProfile(input: UpdateProfileInput) {
  if (!auth.userId) {
    throw new Error('Sign in to update your profile.');
  }

  if (
    input.depthPreference &&
    !['beginner', 'enthusiast', 'expert'].includes(input.depthPreference)
  ) {
    throw new Error('Pick beginner, enthusiast, or expert.');
  }

  // Build a clean patch, dropping undefined and trimming strings.
  const patch: Record<string, unknown> = {};
  if (typeof input.displayName === 'string') {
    patch.displayName = input.displayName.trim() || undefined;
  }
  if (input.depthPreference) {
    patch.depthPreference = input.depthPreference;
  }
  if (typeof input.tasteSeed === 'string') {
    // Cap to 1500 chars. Empty string clears the seed.
    const trimmed = input.tasteSeed.trim().slice(0, 1500);
    patch.tasteSeed = trimmed || undefined;
  }

  const user = await Users.update(auth.userId, patch);

  // If the user set a taste seed, fire a regen so the seed flows through to
  // tasteSummary immediately.
  if (typeof input.tasteSeed === 'string') {
    runTasteSummaryRegen(auth.userId).catch((err) =>
      console.error('Taste summary regen after seed failed:', err),
    );
  }
  return { user };
}
