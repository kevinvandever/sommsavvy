import { auth } from '../runtime';
import { CellarEntries } from './tables/cellarEntries';
import { runTasteSummaryRegen } from './common/regenerateTasteSummaryInternal';

export async function removeCellarEntry(input: { id: string }) {
  if (!auth.userId) {
    throw new Error('Sign in to edit your cellar.');
  }

  const existing = await CellarEntries.get(input.id);
  if (!existing || existing.userId !== auth.userId) {
    throw new Error('Entry not found.');
  }

  const { deleted } = await CellarEntries.remove(input.id);

  if (deleted) {
    const userId = auth.userId;
    runTasteSummaryRegen(userId).catch((err) => {
      console.error('Background taste regen failed:', err);
    });
  }

  return { deleted };
}
