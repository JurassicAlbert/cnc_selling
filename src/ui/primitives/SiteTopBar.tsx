import Link from 'next/link';

import { DrawIcon, HelpIcon, MailIcon } from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { SITE } from '@/content/pl/site';

/**
 * The slim strip above the main navigation - UX-23, owner request
 * 2026-09-04, arrangement taken from `template.getbazaar.io`.
 *
 * What it does **not** carry is the point. The reference layout puts a
 * promotional claim there ("Free Express Shipping"), and this shop has no
 * such offer: no carrier is integrated, shipping is a flat rate the owner
 * sets, and a strip on every page announcing a benefit that does not exist
 * is precisely the fake-functionality rule this project works under. So the
 * note is one sentence that is already true and already said elsewhere on
 * the site - made to order, engraved - and the rest is the two links a
 * customer most often wants from any page.
 *
 * A Server Component with no client JS, like every other piece of storefront
 * chrome. Below 600px the note drops and only the links remain: a strip is
 * worth its vertical space on a phone only for the things a customer taps.
 */
export function SiteTopBar() {
  return (
    <div className="site-topbar">
      <Container>
        <div className="site-topbar-row">
          <span className="site-topbar-note">
            <DrawIcon size={16} />
            {SITE.topbarNotePl}
          </span>

          <nav className="site-topbar-links" aria-label={SITE.topbarHelpLinkPl}>
            <Link href="/faq" className="site-topbar-link">
              <HelpIcon size={14} /> {SITE.topbarHelpLinkPl}
            </Link>
            <Link href="/kontakt" className="site-topbar-link">
              <MailIcon size={14} /> {SITE.topbarContactLinkPl}
            </Link>
          </nav>
        </div>
      </Container>
    </div>
  );
}
