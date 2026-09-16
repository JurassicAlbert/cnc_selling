import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The loading state, and the owner's brief for it on 2026-09-16:
 *
 * > there should be lazy load animations - that are not a goal for client to
 * > see but to be available in corner case where page still need long time to
 * > load
 *
 * That second clause is the whole design. Measured on a production build the
 * same day, storefront routes answer in **35 to 46 ms** and the admin
 * dashboard in 69 ms, so a spinner that appears instantly would be a flicker
 * on every navigation - noise that makes a fast site feel busy. It has to be
 * **invisible during a normal navigation and present when something is
 * genuinely slow**.
 *
 * A CSS `animation-delay` does exactly that with no client JavaScript, which
 * matters because the storefront chrome deliberately ships none
 * (`theme-vars.css` records the Lighthouse audit behind that decision). The
 * element is rendered and transparent; if the navigation finishes first,
 * nobody ever sees it.
 */

const read = (file: string): string => readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('the loading indicator only shows up when it is needed', () => {
  const css = read('src/app/theme-vars.css');

  it('stays invisible for the first moments of a navigation', () => {
    /*
      Without a delay this is a flicker on every single navigation, because
      almost every navigation is faster than a person can perceive. The delay
      is what turns a spinner into a slow-page indicator.
    */
    const block = css.slice(css.indexOf('.route-loading-indicator'));
    expect(block).toMatch(/animation[^;]*\b(\d{3,}ms|\d+(\.\d+)?s)\b[^;]*\bboth\b/);
    // `both` so the fill mode holds the from-state during the delay; without
    // it the element is fully visible until the animation starts.
    expect(block.slice(0, 600)).toMatch(/both/);
  });

  it('respects prefers-reduced-motion', () => {
    // A spinning element is exactly what that setting exists to stop. It may
    // stop moving; it must not become invisible, or a user who set it loses
    // the indicator altogether.
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*?route-loading-indicator/);
  });
});

describe('every part of the app has a loading state', () => {
  /*
    `loading.tsx` at a route-group root covers every page beneath it. The
    storefront and marketing groups had one; **the admin panel had none at
    all**, found on 2026-09-16 - and it is the slowest part of the app, since
    its dashboard aggregates over every order line. The place most likely to
    need a loading state was the one place without one.
  */
  it.each([
    ['(marketing)', 'src/app/(marketing)/loading.tsx'],
    ['(shop)', 'src/app/(shop)/loading.tsx'],
    ['(admin)', 'src/app/(admin)/panel/loading.tsx'],
  ])('%s has one', (_group, file) => {
    expect(existsSync(path.resolve(process.cwd(), file)), `${file} is missing`).toBe(true);
  });
});
