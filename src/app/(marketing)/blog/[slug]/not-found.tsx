import { NotFoundContent } from '@/ui/primitives/NotFoundContent';
import { SITE } from '@/content/pl/site';

/**
 * UX-06. Reached by an unknown slug and by a real post that is not published
 * yet - `getPublishedBlogPostBySlug` returns null for both, deliberately, so
 * a draft shared too early looks exactly like a typo and neither confirms
 * the other.
 */
export default function BlogPostNotFound() {
  return <NotFoundContent headingPl={SITE.blogPostNotFoundPl} />;
}
