import { NotFoundContent } from '@/ui/primitives/NotFoundContent';
import { SITE } from '@/content/pl/site';

/**
 * UX-06. This used to render the heading and the literal „404" and nothing
 * else - no link home, no link to the collections, no way on. A retired or
 * renamed category is an ordinary miss, not an exceptional one, so the page
 * a visitor lands on has to be a place they can leave.
 *
 * The heading stays specific: the page they asked for is fine, the category
 * is what is gone, and „Nie znaleziono takiej strony" sends someone looking
 * for a bad link instead of looking for another category.
 */
export default function CategoryNotFound() {
  return <NotFoundContent headingPl={SITE.catalogueCategoryNotFoundPl} />;
}
