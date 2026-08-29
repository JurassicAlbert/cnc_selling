/**
 * 404 boundary for `notFound()` called from inside a `(marketing)` route.
 * Reached in real, non-exceptional use today: `/wzory` calls `notFound()`
 * deliberately (owner's request to hide the patterns page for now), so this
 * is a page real visitors land on, not just an error path.
 *
 * No `StorefrontChrome` — `(marketing)/layout.tsx` already rendered it.
 * See `NotFoundContent`'s header for the full rule.
 */
export { NotFoundContent as default } from '@/ui/primitives/NotFoundContent';
