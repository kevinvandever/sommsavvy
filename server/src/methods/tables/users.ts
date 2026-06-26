import { db } from '../../runtime';

// The auth table for SommSavvy. `email` is populated when a user verifies an
// email code; all other columns are ours to write. New users get
// depthPreference defaulted to 'enthusiast'.
export interface User {
  email: string;
  displayName?: string;
  depthPreference?: 'beginner' | 'enthusiast' | 'expert';
  // The user's self-described taste, captured optionally during welcome. Fed
  // verbatim into the taste-summary regeneration as foundational context.
  tasteSeed?: string;
  tasteSummary?: string;
  tasteSummaryUpdatedAt?: number; // unix ms
}

export const Users = db.defineTable<User>('users', {
  defaults: {
    depthPreference: 'enthusiast',
  },
});
