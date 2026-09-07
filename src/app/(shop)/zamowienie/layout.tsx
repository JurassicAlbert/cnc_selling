import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * No chrome of its own - this layout exists only to own the `robots` rule
 * for everything under `/zamowienie`, which is the pattern
 * `(shop)/moje-konto/layout.tsx` and `(admin)/panel/layout.tsx` already use.
 *
 * It was moved here from the confirmation page during UX-06. That page had
 * to become a `generateMetadata` so the tab could stop saying „Zamówienie
 * przyjęte" over a not-found, and Next.js allows a route to export
 * `metadata` or `generateMetadata` but not both. Putting `robots` in a
 * function would have taken it out of reach of `robots-noindex.test.ts`,
 * which asserts it by reading a plain object with no request context - so
 * the rule that must never quietly lapse (BUG-17: a confirmation URL is a
 * credential, and must not be indexed) stays a static object, on the
 * segment above.
 *
 * Metadata merges down the tree, and the page below sets only `title`, so
 * this survives on every route under it.
 */
export const metadata: Metadata = {
  robots: { index: false },
};

export default function OrderLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
