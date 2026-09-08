import { NotFoundContent } from '@/ui/primitives/NotFoundContent';
import { SITE } from '@/content/pl/site';

/**
 * UX-06. Reached from a bookmarked design that has since been deleted, and
 * from an id belonging to somebody else - `requireOwnedDesignStatus`'s
 * 404-not-403 discipline means those are the same page on purpose, so the
 * heading names the design and nothing about who owns it.
 *
 * The tab keeps the section's own title („Moje wzory") rather than gaining a
 * `generateMetadata` of its own: this route is behind sign-in, so no crawler
 * ever sees it, and the ownership lookup exists only to answer the question
 * the page has already answered. Naming the section a signed-in customer is
 * still inside is not wrong, unlike the order route's „Zamówienie przyjęte",
 * which claimed something that had not happened.
 */
export default function AccountDesignNotFound() {
  return <NotFoundContent headingPl={SITE.designDetailNotFoundPl} />;
}
