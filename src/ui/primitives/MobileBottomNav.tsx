import Link from 'next/link';

import { SITE } from '@/content/pl/site';
import { CartIcon, CollectionsIcon, HomeIcon, PersonIcon } from '@/ui/icons';

/**
 * The phone-sized navigation bar pinned to the bottom of every storefront
 * page - `docs/AI-CHECKLIST.md` RWD-05.
 *
 * The owner pointed at this by citing `template.getbazaar.io`, which keeps
 * Home / Category / Cart-with-its-count / Account there on every page. Ours
 * reached all four only through the burger menu or by scrolling to the
 * footer, which on a phone is the difference between one thumb tap and two
 * taps plus a scroll - on the controls a shopper uses most.
 *
 * **The destinations are mapped, not copied.** „Kolekcje" takes the
 * reference's "Category" slot because `/kolekcje` is a real browsing page
 * here, while categories are already one tap from the burger and from the
 * home grid; a bottom-nav entry duplicating the home page would spend a
 * quarter of the bar on nothing.
 *
 * Zero client JS, like the rest of this chrome: four links and the same
 * server-read cart summary the header badge uses, so the two counts cannot
 * disagree. Hidden at 900 px and up, the burger's own breakpoint, where the
 * full navigation is already on screen.
 *
 * `data-bottom-nav` is for the e2e geometry check, which has to find this
 * element without depending on a class name that styling might change.
 */
export function MobileBottomNav({ cartItemCount }: { readonly cartItemCount: number }) {
  return (
    <nav aria-label={SITE.bottomNavLabelPl} data-bottom-nav className="bottom-nav">
      <Link href="/" className="bottom-nav-link">
        <HomeIcon size={22} />
        <span>{SITE.bottomNavHomePl}</span>
      </Link>
      <Link href="/kolekcje" className="bottom-nav-link">
        <CollectionsIcon size={22} />
        <span>{SITE.bottomNavCollectionsPl}</span>
      </Link>
      <Link href="/koszyk" className="bottom-nav-link">
        <span className="bottom-nav-icon-wrap">
          <CartIcon size={22} />
          {/*
            The count is inside the link's own text, not only in an
            `aria-label`: the label already names the cart for a screen
            reader, and a number a sighted customer can see but a test cannot
            read from the accessible name is a number nothing can check.
          */}
          {cartItemCount > 0 && <span className="bottom-nav-badge">{cartItemCount}</span>}
        </span>
        <span>{SITE.bottomNavCartPl}</span>
      </Link>
      <Link href="/moje-konto" className="bottom-nav-link">
        <PersonIcon size={22} />
        <span>{SITE.bottomNavAccountPl}</span>
      </Link>
    </nav>
  );
}
