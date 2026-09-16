import { RouteLoading } from '@/ui/primitives/RouteLoading';

/**
 * The admin panel had **no loading state at all** until 2026-09-16, found
 * while acting on the owner's request for one.
 *
 * It is the part of the app most likely to need one. Every storefront route
 * answers in 35 to 46 ms, while this dashboard aggregates over every order
 * line in the range - 116 ms before that query was fixed, 69 ms after, and
 * both of those are against a development database with a handful of orders.
 * It is the page whose cost grows with the business.
 *
 * At the `panel/` root rather than per-screen, so every admin route beneath
 * it is covered by one file: `/panel/zamowienia`, `/panel/produkty`, and the
 * twenty-odd others.
 */
export default function PanelLoading() {
  return <RouteLoading />;
}
