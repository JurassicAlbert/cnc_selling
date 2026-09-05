/**
 * `docs/AI-CHECKLIST.md` BUG-17, the half `robots.txt` cannot do.
 *
 * `robots.test.ts` pins that crawlers are asked not to *fetch* the private
 * routes. That is not the same as keeping them out of an index: a
 * `Disallow`ed URL that something links to can still be listed, without a
 * snippet, precisely because the crawler was told not to look at it. Only a
 * `noindex` on the page removes it - and a crawler only sees that if it is
 * allowed to fetch the page. Neither mechanism is redundant and neither is
 * sufficient.
 *
 * Asserted by reading each route's exported `metadata`, which is a plain
 * object with no request context, so this needs no server and no browser.
 * The layouts are covered too: `metadata` on a layout applies to every route
 * beneath it, which is the whole reason to put it there rather than on nine
 * account pages individually.
 */

import { describe, expect, it } from 'vitest';

import { metadata as accountMetadata } from '@/app/(shop)/moje-konto/layout';
import { metadata as cartMetadata } from '@/app/(shop)/koszyk/page';
import { metadata as loginMetadata } from '@/app/(shop)/logowanie/page';
import { metadata as orderCheckMetadata } from '@/app/(shop)/zamowienie/sprawdz/page';
import { metadata as orderMetadata } from '@/app/(shop)/zamowienie/[orderNumber]/page';
import { metadata as panelMetadata } from '@/app/(admin)/panel/layout';
import { metadata as registerMetadata } from '@/app/(shop)/rejestracja/page';
import { metadata as searchMetadata } from '@/app/(shop)/szukaj/page';

const PRIVATE_ROUTES = [
  ['the guest order confirmation - its ?token= query string is the credential', orderMetadata],
  ['the order lookup form', orderCheckMetadata],
  ['every /moje-konto page, via the layout', accountMetadata],
  ['every /panel page, via the layout', panelMetadata],
  ['the cart', cartMetadata],
  ['sign in', loginMetadata],
  ['sign up', registerMetadata],
  ['search results', searchMetadata],
] as const;

describe('private routes tell crawlers not to index them', () => {
  it.each(PRIVATE_ROUTES)('%s', (_why, metadata) => {
    expect(metadata.robots).toMatchObject({ index: false });
  });
});
