'use server';

/**
 * The global-search Server Action - unlike every other read in this
 * codebase (a repository function called directly from an already-gated
 * Server Component), this one is invoked via `fetch`-as-you-type from a
 * client island. A Server Action is a directly-POSTable endpoint once its
 * id is known, independent of which page's `requireStaffSession()` gate a
 * client happened to load it from - so this wrapper re-derives the session
 * itself, the same discipline every mutating action already applies, now
 * extended to the first read that needed it.
 */

import { requireStaffSession } from '@/server/auth/session';
import { searchGlobal as searchGlobalRepo } from '@/server/repositories/admin-global-search';
import type { GlobalSearchResults } from '@/server/repositories/admin-global-search';

export async function searchGlobal(query: string): Promise<GlobalSearchResults> {
  await requireStaffSession();
  return searchGlobalRepo(query);
}
