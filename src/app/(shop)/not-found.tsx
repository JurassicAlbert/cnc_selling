/**
 * 404 boundary for `notFound()` called from inside a `(shop)` route - an
 * order number that isn't yours, a product slug that no longer resolves.
 *
 * No `StorefrontChrome` here on purpose: `(shop)/layout.tsx` has already
 * rendered it by the time this boundary is reached. The root
 * `app/not-found.tsx` DOES render it, because a completely unmatched URL
 * never reaches a group layout at all. Rendering it in both places drew
 * the header and search bar twice - see `NotFoundContent`'s header.
 */
export { NotFoundContent as default } from '@/ui/primitives/NotFoundContent';
