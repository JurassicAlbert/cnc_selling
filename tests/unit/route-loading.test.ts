import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SITE } from '@/content/pl/site';
import { RouteLoading } from '@/ui/primitives/RouteLoading';

/**
 * `docs/AI-CHECKLIST.md` UX-15, the half of it that turned out to be a real
 * defect.
 *
 * The item asked for a `Skeleton` instead of the literal „Ładowanie…", and
 * that part was measured and declined - see the item. What the measurement
 * did not excuse is that this state **says nothing to a screen reader**. A
 * sighted visitor sees the word; someone using a screen reader gets silence
 * between the click and the new page, which is the case a loading state
 * exists for in the first place.
 *
 * `role="status"` rather than `aria-live="polite"` written out: the role
 * carries that live-region politeness itself and states what the region is,
 * which is the idiomatic pairing.
 *
 * Rendered to markup rather than asserted on the source, because an attribute
 * that never reaches the DOM is exactly the failure being guarded against -
 * the same reasoning `mobile-rwd.spec.ts` gives for checking `autocomplete`
 * in a browser. No JSX: `tests/**\/*.test.ts` is the only pattern Vitest
 * collects here, so `createElement` keeps this a `.ts` file.
 */
describe('RouteLoading', () => {
  const html = renderToStaticMarkup(createElement(RouteLoading));

  it('announces itself to a screen reader', () => {
    expect(html).toContain('role="status"');
  });

  it('still says what it says, in Polish, from the content file', () => {
    // The announcement is worth nothing if the region is empty.
    expect(html).toContain(SITE.routeLoadingPl);
  });
});
