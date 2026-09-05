/**
 * The shape every paginated admin list returns.
 *
 * Its own module so the three repositories share one definition rather than
 * three that can drift - `docs/AI-CHECKLIST.md` ADMIN-01.
 */
/**
 * One page of a list, plus how many rows there are in total.
 *
 * `total` is the count of everything matching the filter, not the length of
 * `items` - it is what lets the grid offer the right number of pages, and
 * what lets the page say „Pokazano 1-25 z 166" instead of quietly showing a
 * subset. See `docs/AI-CHECKLIST.md` ADMIN-01 for what it was before.
 */
export type Page<T> = {
  readonly items: readonly T[];
  readonly total: number;
};
