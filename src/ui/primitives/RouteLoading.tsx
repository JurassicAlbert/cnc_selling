import { SITE } from '@/content/pl/site';
import { Container } from '@/ui/primitives/Container';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

/**
 * Shared `loading.tsx` fallback - P6 Part F. A route segment's own
 * `loading.tsx` renders this WHILE that segment's Server Component awaits
 * its data (a real DB read on every page in this app), instead of the
 * browser showing a blank tab during navigation. Deliberately plain - an
 * honest "loading" state, not a layout-shifting skeleton mimicking content
 * this project doesn't maintain two copies of.
 *
 * **UX-15 asked for that skeleton and it was measured and declined.** Every
 * shop route answers in 22 to 56 ms on a production build (the product page,
 * the heaviest, in 99 ms), so this is on screen for a few frames: a skeleton
 * would be a second copy of every layout, and a layout-shift risk, for a
 * state nobody sees.
 *
 * **What the measurement did not excuse is the silence.** A sighted visitor
 * reads the word; a screen-reader user got nothing at all between the click
 * and the new page, which is precisely the gap a loading state exists to
 * fill. `role="status"` makes it a polite live region and says what the
 * region is - the role carries the politeness, so a separate `aria-live` is
 * redundant.
 *
 * **And it did not excuse the height, which UX-15 missed.** Found on
 * 2026-09-12 while diagnosing UX-29: during a client-side navigation `main`
 * collapses to this fallback - measured at **219 px against the 1 258 px of
 * real content that replaces it** - so the document shrinks from 2 272 px to
 * 1 234 px and the footer leaps about a thousand pixels up and back. Chromium
 * scored that as a **0.216 layout shift**, attributed to `FOOTER`: past
 * Google's 0.1 "good" threshold and close to the 0.25 where it is called
 * poor. On every client-side navigation on the site.
 *
 * `min-block-size` fixes it without the skeleton UX-15 declined. A skeleton
 * exists to hold a shape; all that is needed here is to hold the *space*, and
 * one line does that without a second copy of every layout to maintain. 60vh
 * rather than a pixel value so it scales with the viewport, and it is a
 * minimum, so a page whose content is shorter still renders normally.
 */
export function RouteLoading() {
  return (
    <Section>
      <Container>
        <div role="status" style={{ minBlockSize: '60vh' }}>
          <Text muted>{SITE.routeLoadingPl}</Text>
        </div>
      </Container>
    </Section>
  );
}
