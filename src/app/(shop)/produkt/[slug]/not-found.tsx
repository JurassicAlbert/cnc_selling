import { NotFoundContent } from '@/ui/primitives/NotFoundContent';
import { SITE } from '@/content/pl/site';

/**
 * UX-06, and the most costly of the three: a product that sold out and was
 * unpublished, or whose slug changed, is the miss most likely to arrive from
 * a real customer following a real link. It answered with a heading, the
 * literal „404" and no way onward, which turns a lost sale into a lost
 * visitor.
 */
export default function ProductNotFound() {
  return <NotFoundContent headingPl={SITE.catalogueProductNotFoundPl} />;
}
