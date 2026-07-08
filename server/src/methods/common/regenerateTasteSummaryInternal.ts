import { db, mindstudio } from '../../runtime';
import { Users } from '../tables/users';
import { CellarEntries } from '../tables/cellarEntries';
import { TASTE_SUMMARY_SYSTEM } from './voice';

// Internal helper: regenerates a user's tasteSummary. Called fire-and-forget
// from save/update/remove and from updateProfile when the user sets a seed.
// Safe to await for testing.
//
// The summary is derived from two sources, each used when available:
//   1. The user's self-described taste (tasteSeed) — verbatim context.
//   2. The user's cellar entries (notes + producer + region + vintage).
export async function runTasteSummaryRegen(userId: string): Promise<void> {
  // Load the user (for tasteSeed) and their most recent fifty cellar entries
  // in one round-trip.
  const [user, entries] = await db.batch(
    Users.get(userId),
    CellarEntries
      .filter(
        (e, $) => e.userId === $.userId,
        { userId }, // bindings: lifts closure var so filter compiles to SQL
      )
      .sortBy((e) => e.savedAt)
      .reverse()
      .take(50),
  );

  // INVARIANT: Taste intelligence is built ONLY from tasted entries. `tasted !== false`
  // includes explicit true AND legacy null rows, excluding only entries the
  // user has explicitly un-marked as tasted. Entries where only `owned` changed
  // are never excluded — `owned` has no bearing on the taste signal.
  const tastedEntries = entries.filter((e) => e.tasted !== false);

  const seed = user?.tasteSeed?.trim();
  const hasEntries = tastedEntries.length >= 3;

  // No seed AND not enough entries — clear the summary and bail.
  if (!seed && !hasEntries) {
    await Users.update(userId, {
      tasteSummary: '',
      tasteSummaryUpdatedAt: Date.now(),
    });
    return;
  }

  // Build the prompt sections conditionally.
  const sections: string[] = [];
  if (seed) {
    sections.push(`The user's own words on their taste:\n"${seed}"`);
  }
  if (hasEntries) {
    const lines = tastedEntries.map((e) => {
      const parts = [
        `${e.kind.toUpperCase()}: ${e.name}`,
        e.producer && `producer: ${e.producer}`,
        e.region && `region: ${e.region}`,
        e.vintage && `vintage: ${e.vintage}`,
        e.notes && `notes: "${e.notes}"`,
      ].filter(Boolean);
      return `- ${parts.join(', ')}`;
    });
    sections.push(`The user's cellar (most recent first):\n${lines.join('\n')}`);
  }

  // Guidance to the model on how to weigh seed vs. entries.
  const guidance =
    seed && hasEntries
      ? 'Both sources matter. The seed reflects what the user thinks of their own taste; the cellar shows what they actually reach for. Reconcile both. If the cellar contradicts the seed, name the contradiction lightly.'
      : seed
        ? "Treat the seed as the source of truth. Rewrite it in your editorial voice — do not just paraphrase. Capture the actual preferences and turn them into a sommelier's read."
        : 'Derive the summary from the cellar entries alone.';

  try {
    const { content } = await mindstudio.generateText({
      message: `${TASTE_SUMMARY_SYSTEM}\n\n${sections.join('\n\n')}\n\n${guidance}\n\nWrite the 2-3 sentence summary now.`,
      modelOverride: {
        model: 'claude-4-5-haiku',
        temperature: 0.7,
        maxResponseTokens: 16000,
      },
    });

    await Users.update(userId, {
      tasteSummary: (typeof content === 'string' ? content : '').trim(),
      tasteSummaryUpdatedAt: Date.now(),
    });
  } catch (err) {
    console.error('Taste summary regeneration failed:', err);
    // Do not throw. The cellar mutation is the user-facing op; this is background.
  }
}
