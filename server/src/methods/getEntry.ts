import { auth } from '../runtime';
import { CellarEntries } from './tables/cellarEntries';

export async function getEntry(input: { id: string }) {
  if (!auth.userId) {
    throw new Error('Sign in to view this entry.');
  }

  const entry = await CellarEntries.get(input.id);
  if (!entry || entry.userId !== auth.userId) {
    throw new Error('Entry not found.');
  }

  return { entry };
}
