/**
 * Generates a free `-kopia`/`-kopia-2`/... slug variant off an existing
 * one — the "Duplicate" action's slug-collision problem, the same shape
 * for every entity that has it (Product, Material, Design). Takes the
 * collision check as a callback rather than a Prisma model name so it
 * stays usable for `Design`'s two independently-unique fields (`slug`
 * AND `code`) with the same function.
 */
export async function nextAvailableSlug(baseSlug: string, isTaken: (candidate: string) => Promise<boolean>): Promise<string> {
  const first = `${baseSlug}-kopia`;
  if (!(await isTaken(first))) {
    return first;
  }
  for (let n = 2; n < 1000; n++) {
    const candidate = `${baseSlug}-kopia-${n}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
  // Unreachable in practice — 999 real duplicates of one record — but a
  // real return keeps this total rather than throwing past that point.
  return `${baseSlug}-kopia-${Date.now()}`;
}
