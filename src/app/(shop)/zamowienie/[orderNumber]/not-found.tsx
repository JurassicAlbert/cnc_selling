import { NotFoundContent } from '@/ui/primitives/NotFoundContent';
import { SITE } from '@/content/pl/site';

/**
 * UX-06, and the one BUG-33 recorded as actively misleading: an emailed
 * confirmation link opened in another browser has no access cookie, so it
 * lands here - and the page said „Nie znaleziono takiej strony", which sends
 * the customer hunting for a broken link when the fix is to open the email
 * where they first opened it.
 *
 * **This says no more than the generic page did.** §16.1's "404, not 403"
 * still holds: a wrong token, a missing cookie and an order number nobody
 * ever issued all render this identically, so an order's existence stays
 * unprobeable. The heading names the route, which the address bar already
 * does.
 */
export default function OrderNotFound() {
  return <NotFoundContent headingPl={SITE.orderNotFoundPl} />;
}
