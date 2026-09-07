import { NotFoundContent } from '@/ui/primitives/NotFoundContent';
import { SITE } from '@/content/pl/site';

/**
 * UX-06. New, and it is what put `SITE.collectionNotFoundPl` to work: the
 * string had been written for this and never connected, so a dead collection
 * link - the kind that outlives a newsletter by months - fell through to the
 * group boundary and said the page did not exist.
 */
export default function CollectionNotFound() {
  return <NotFoundContent headingPl={SITE.collectionNotFoundPl} />;
}
