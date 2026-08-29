/**
 * Group-level loading fallback for every `(shop)` route that doesn't
 * define its own — `docs/AUDIT-2026-08-30.md` §7 found 22 routes with no
 * loading UI at all, including checkout, order history, order detail and
 * the collection pages, every one of which does a real database read
 * before it can render anything.
 *
 * One file at the group level rather than 22 copies: Next.js applies the
 * nearest `loading.tsx` up the tree, so the four routes that already have
 * their own keep theirs and everything else inherits this.
 */
export { RouteLoading as default } from '@/ui/primitives/RouteLoading';
