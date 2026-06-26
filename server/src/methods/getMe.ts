import { db, auth } from '../runtime';
import { Users } from './tables/users';
import { CellarEntries } from './tables/cellarEntries';

// Bundle: the current user, their cellar count, and the most recent few
// entries. The frontend calls this once on app boot to populate state.
// Anonymous callers get null.
export async function getMe() {
  if (!auth.userId) {
    return { user: null, cellarCount: 0, recentEntries: [] };
  }

  const userId = auth.userId;

  const [user, cellarCount, recentEntries] = await db.batch(
    Users.get(userId),
    CellarEntries.count(
      (e, $) => e.userId === $.userId,
      { userId }, // bindings: lifts closure var so filter compiles to SQL
    ),
    CellarEntries
      .filter(
        (e, $) => e.userId === $.userId,
        { userId }, // bindings: lifts closure var so filter compiles to SQL
      )
      .sortBy((e) => e.savedAt)
      .reverse()
      .take(8),
  );

  return { user, cellarCount, recentEntries };
}
