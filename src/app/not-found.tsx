import { StorefrontChrome } from '@/ui/layout/StorefrontChrome';
import { NotFoundContent } from '@/ui/primitives/NotFoundContent';

/**
 * The catch-all 404, for a URL that matches no route at all —
 * `docs/AUDIT-2026-08-30.md` P2-10. There genuinely wasn't one: three
 * routes had their own, and every other `notFound()` — an order that isn't
 * yours, a staff-only page reached as a `CUSTOMER` (§16.2's "404, not 403"
 * rule sends people here deliberately) — fell through to Next.js's own
 * black-and-white English default, which in a Polish storefront reads as
 * the site being broken rather than the address being wrong.
 *
 * This boundary sits under the bare root layout, outside
 * `(shop)`/`(marketing)`, so it renders `StorefrontChrome` itself —
 * otherwise a 404 would have no nav and no footer, exactly the dead end a
 * 404 must not be. The group-scoped boundaries next to the group layouts
 * deliberately do NOT, because there the chrome is already there; see
 * `NotFoundContent`'s own header.
 */
export default function NotFound() {
  return (
    <StorefrontChrome>
      <NotFoundContent />
    </StorefrontChrome>
  );
}
